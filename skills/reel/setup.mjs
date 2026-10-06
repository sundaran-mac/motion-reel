#!/usr/bin/env node
// One-time setup for the reel skill, on Apple Silicon Macs and Windows x64.
// Safe to run again: every finished step is skipped.
//
// Usage:
//   node setup.mjs                 do the setup
//   node setup.mjs --check         only report what is there, change nothing
//   node setup.mjs --skip-catalog  do everything except the audio catalog
//
// Uses Node built-ins only. Every child process gets an argument array, never a shell string.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {Readable} from 'node:stream';
import {fileURLToPath} from 'node:url';

const args = process.argv.slice(2);
const CHECK = args.includes('--check');
const SKIP_CATALOG = args.includes('--skip-catalog');

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: node setup.mjs [--check] [--skip-catalog]');
  process.exit(0);
}

const PLATFORM = `${process.platform}-${process.arch}`;
const IS_WIN = process.platform === 'win32';
if (PLATFORM !== 'darwin-arm64' && PLATFORM !== 'win32-x64') {
  console.error(`This system (${PLATFORM}) is not supported.`);
  console.error('The reel skill supports Apple Silicon Macs (darwin-arm64) and Windows x64 (win32-x64).');
  process.exit(1);
}

const SKILL_DIR = path.dirname(fileURLToPath(import.meta.url));
const REEL_HOME = process.env.REEL_HOME ? path.resolve(process.env.REEL_HOME) : path.join(os.homedir(), 'Reels');
const LIB = path.join(REEL_HOME, '.library');
const VENV = path.join(LIB, 'venv');
const VENV_PY = IS_WIN ? path.join(VENV, 'Scripts', 'python.exe') : path.join(VENV, 'bin', 'python');
const KOKORO_DIR = path.join(LIB, 'kokoro');
const CHROME_DIR = path.join(LIB, 'chrome');
const CONFIG = path.join(LIB, 'config.json');

const KOKORO_BASE = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0';
const KOKORO_FILES = [
  {name: 'kokoro-v1.0.onnx', size: 325532387},
  {name: 'voices-v1.0.bin', size: 28214398},
];
const PY_PACKAGES = ['kokoro-onnx', 'soundfile', 'numpy'];
const CFT_JSON = 'https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json';
const CFT_PLATFORM = IS_WIN ? 'win64' : 'mac-arm64';
const CHROME_FOLDER = `chrome-${CFT_PLATFORM}`;
const CHROME_EXE = IS_WIN
  ? path.join(CHROME_DIR, CHROME_FOLDER, 'chrome.exe')
  : path.join(CHROME_DIR, CHROME_FOLDER, 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing');

const results = [];
const MB = 1024 * 1024;

function line(step, status, detail) {
  results.push({step, status, detail});
  console.log(`[${status}] ${step}: ${detail}`);
}

class Stop extends Error {}

function run(cmd, cmdArgs, opts = {}) {
  return spawnSync(cmd, cmdArgs, {encoding: 'utf8', windowsHide: true, ...opts});
}

function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return -1; }
}

// ---------- 1. Node ----------
function stepNode() {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22) {
    const fix = IS_WIN ? 'winget install OpenJS.NodeJS.LTS' : 'brew install node';
    line('Node', 'missing', `Node ${process.versions.node} is too old. Need 22 or later. Install with: ${fix}`);
    throw new Stop();
  }
  line('Node', 'ok', `Node ${process.versions.node}`);
}

// ---------- 2. Folders ----------
function stepFolders() {
  if (fs.existsSync(LIB)) return line('Folders', 'ok', LIB);
  if (CHECK) return line('Folders', 'missing', `${LIB} does not exist yet`);
  fs.mkdirSync(LIB, {recursive: true});
  line('Folders', 'done', `made ${LIB}`);
}

// ---------- 3. Python ----------
// Each candidate is [command, args]. Preferred versions first, because the voice
// packages need prebuilt wheels and the newest Python may not have them yet.
function pythonCandidates() {
  if (IS_WIN) {
    return [
      ['py', ['-3.12']], ['py', ['-3.13']], ['py', ['-3.11']], ['py', ['-3.10']],
      ['py', ['-3']], ['python', []],
    ];
  }
  return [
    ['python3.12', []], ['python3.13', []], ['python3.11', []], ['python3.10', []], ['python3', []],
  ];
}

function findPython() {
  const probe = 'import sys; print(sys.version_info[0], sys.version_info[1]); print(sys.executable)';
  for (const [cmd, pre] of pythonCandidates()) {
    const r = run(cmd, [...pre, '-c', probe]);
    if (r.error || r.status !== 0 || !r.stdout) continue;
    const [ver, exe] = r.stdout.trim().split(/\r?\n/);
    const [maj, min] = ver.split(' ').map(Number);
    if (maj === 3 && min >= 10) return {cmd, pre, version: `${maj}.${min}`, exe: exe.trim()};
  }
  return null;
}

let python = null;
function stepPython() {
  python = findPython();
  if (python) return line('Python', 'ok', `Python ${python.version} (${python.exe})`);
  const fix = IS_WIN ? 'winget install Python.Python.3.12' : 'brew install python@3.12';
  line('Python', 'missing', `Python 3.10 or later not found. Install with: ${fix}  then run setup again`);
  if (!CHECK) throw new Stop();
}

// ---------- 4. venv and packages ----------
function venvHasPackages() {
  if (!fs.existsSync(VENV_PY)) return false;
  const r = run(VENV_PY, ['-c', 'import kokoro_onnx, soundfile, numpy']);
  return !r.error && r.status === 0;
}

function stepVenv() {
  if (venvHasPackages()) return line('Voice packages', 'ok', `${PY_PACKAGES.join(', ')} in ${VENV}`);
  if (CHECK) return line('Voice packages', 'missing', `no working venv with ${PY_PACKAGES.join(', ')} at ${VENV}`);
  if (!python) throw new Stop();
  if (!fs.existsSync(VENV_PY)) {
    console.log(`  making a Python venv at ${VENV}`);
    // --clear also repairs a venv whose Python was removed or upgraded.
    const r = run(python.cmd, [...python.pre, '-m', 'venv', '--clear', VENV], {stdio: 'inherit'});
    if (r.error || r.status !== 0) throw new Error(`could not make the venv (${r.error?.message ?? `exit ${r.status}`})`);
  }
  console.log(`  installing ${PY_PACKAGES.join(', ')} (about 100 MB, a few minutes)`);
  const r = run(VENV_PY, ['-m', 'pip', 'install', '--disable-pip-version-check', ...PY_PACKAGES], {stdio: 'inherit'});
  if (r.error || r.status !== 0) throw new Error(`pip install failed (${r.error?.message ?? `exit ${r.status}`})`);
  if (!venvHasPackages()) throw new Error('packages installed but import still fails');
  line('Voice packages', 'done', `installed ${PY_PACKAGES.join(', ')}`);
}

// ---------- download helper ----------
// Streams to <dest>.part and renames when complete. If a .part file is left from a
// stopped run, it asks the server for the rest (HTTP Range) instead of starting again.
async function download(url, dest, label, expectedSize) {
  const part = `${dest}.part`;
  let have = Math.max(0, fileSize(part));
  if (expectedSize && have > expectedSize) { fs.rmSync(part, {force: true}); have = 0; }
  const headers = have > 0 ? {Range: `bytes=${have}-`} : {};
  const res = await fetch(url, {headers, redirect: 'follow'});
  if (res.status === 416 && expectedSize && have === expectedSize) {
    fs.renameSync(part, dest);
    return;
  }
  if (!res.ok) throw new Error(`${label}: HTTP ${res.status} from ${url}`);
  if (res.status !== 206) have = 0; // server sent the whole file, start the .part again
  const total = res.headers.get('content-length') ? have + Number(res.headers.get('content-length')) : expectedSize ?? 0;
  const out = fs.createWriteStream(part, {flags: have > 0 ? 'a' : 'w'});
  let got = have;
  let lastPct = -1;
  const show = () => {
    const pct = total ? Math.floor((got / total) * 100) : 0;
    if (pct === lastPct) return;
    lastPct = pct;
    const text = total
      ? `  ${label} ${pct}% (${Math.round(got / MB)} of ${Math.round(total / MB)} MB)`
      : `  ${label} ${Math.round(got / MB)} MB`;
    if (process.stdout.isTTY) process.stdout.write(`\r${text}   `);
    else if (pct % 10 === 0) console.log(text);
  };
  await new Promise((resolve, reject) => {
    const body = Readable.fromWeb(res.body);
    body.on('data', chunk => { got += chunk.length; show(); });
    body.on('error', reject);
    out.on('error', reject);
    out.on('finish', resolve);
    body.pipe(out);
  });
  if (process.stdout.isTTY) process.stdout.write('\n');
  const size = fileSize(part);
  if (size < MB) throw new Error(`${label}: download is only ${size} bytes, expected more than 1 MB`);
  if (expectedSize && size !== expectedSize) throw new Error(`${label}: got ${size} bytes, expected ${expectedSize}. Run setup again to resume.`);
  fs.renameSync(part, dest);
}

// ---------- 5. Kokoro model ----------
async function stepKokoro() {
  const missing = KOKORO_FILES.filter(f => fileSize(path.join(KOKORO_DIR, f.name)) !== f.size);
  if (missing.length === 0) return line('Voice model', 'ok', `${KOKORO_FILES.map(f => f.name).join(', ')} in ${KOKORO_DIR}`);
  if (CHECK) return line('Voice model', 'missing', `${missing.map(f => f.name).join(', ')} not in ${KOKORO_DIR}`);
  fs.mkdirSync(KOKORO_DIR, {recursive: true});
  for (const f of missing) {
    await download(`${KOKORO_BASE}/${f.name}`, path.join(KOKORO_DIR, f.name), f.name, f.size);
  }
  line('Voice model', 'done', `downloaded ${missing.map(f => `${f.name} (${Math.round(f.size / MB)} MB)`).join(', ')}`);
}

// ---------- 6. Render browser ----------
function unzip(zip, destDir) {
  if (!IS_WIN) {
    const r = run('ditto', ['-x', '-k', zip, destDir], {stdio: 'inherit'});
    if (r.error || r.status !== 0) throw new Error(`ditto could not unzip ${zip}`);
    return;
  }
  // Windows 10 and 11 ship bsdtar as System32\tar.exe, which reads zip files and is fast.
  // Use the full path, so a Git Bash tar on PATH is never picked by mistake.
  const sysTar = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'tar.exe');
  if (fs.existsSync(sysTar)) {
    const r = run(sysTar, ['-x', '-f', zip, '-C', destDir], {stdio: 'inherit'});
    if (!r.error && r.status === 0) return;
  }
  // Fallback: PowerShell Expand-Archive. Paths go in through env vars, so no quoting is needed.
  const r = run('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    'Expand-Archive -LiteralPath $env:REEL_ZIP -DestinationPath $env:REEL_DEST -Force',
  ], {stdio: 'inherit', env: {...process.env, REEL_ZIP: zip, REEL_DEST: destDir}});
  if (r.error || r.status !== 0) throw new Error(`could not unzip ${zip}`);
}

async function stepChrome() {
  if (fs.existsSync(CHROME_EXE)) return line('Render browser', 'ok', CHROME_EXE);
  if (CHECK) return line('Render browser', 'missing', `no browser at ${CHROME_EXE}`);
  const res = await fetch(CFT_JSON);
  if (!res.ok) throw new Error(`Chrome for Testing list: HTTP ${res.status}`);
  const stable = (await res.json()).channels.Stable;
  const dl = stable.downloads.chrome.find(d => d.platform === CFT_PLATFORM);
  if (!dl) throw new Error(`no Chrome for Testing download for ${CFT_PLATFORM}`);
  fs.mkdirSync(CHROME_DIR, {recursive: true});
  const zip = path.join(CHROME_DIR, `${CHROME_FOLDER}.zip`);
  await download(dl.url, zip, `Chrome for Testing ${stable.version}`);
  fs.rmSync(path.join(CHROME_DIR, CHROME_FOLDER), {recursive: true, force: true});
  console.log('  unzipping');
  unzip(zip, CHROME_DIR);
  fs.rmSync(zip, {force: true});
  if (!fs.existsSync(CHROME_EXE)) throw new Error(`unzipped, but ${CHROME_EXE} is not there`);
  line('Render browser', 'done', `Chrome for Testing ${stable.version} at ${CHROME_EXE}`);
}

// ---------- 7. config.json ----------
function stepConfig() {
  const want = {version: 1, python: VENV_PY, chrome: CHROME_EXE, kokoroDir: KOKORO_DIR, platform: PLATFORM};
  const text = `${JSON.stringify(want, null, 2)}\n`;
  let have = null;
  try { have = fs.readFileSync(CONFIG, 'utf8'); } catch {}
  if (have === text) return line('Config', 'ok', CONFIG);
  if (CHECK) return line('Config', 'missing', have ? `${CONFIG} differs from what setup would write` : `${CONFIG} not written yet`);
  fs.writeFileSync(CONFIG, text);
  line('Config', 'done', `wrote ${CONFIG}`);
}

// ---------- 8. Catalog ----------
function stepCatalog() {
  const catalog = path.join(LIB, 'catalog.json');
  if (fs.existsSync(catalog)) return line('Catalog', 'ok', catalog);
  if (CHECK) return line('Catalog', 'missing', `${catalog} not built yet`);
  if (SKIP_CATALOG) return line('Catalog', 'skipped', '--skip-catalog was given');
  const tool = path.join(SKILL_DIR, 'tools', 'library.mjs');
  if (!fs.existsSync(tool)) return line('Catalog', 'skipped', `${tool} is not there yet`);
  console.log('  building the audio catalog from mixkit.co (about 5 minutes)');
  const r = run(process.execPath, [tool, 'catalog'], {stdio: 'inherit', env: {...process.env, REEL_HOME}});
  if (r.error || r.status !== 0) throw new Error(`catalog build failed (${r.error?.message ?? `exit ${r.status}`})`);
  line('Catalog', 'done', catalog);
}

// ---------- 9. Summary ----------
function summary() {
  const w = Math.max(...results.map(r => r.step.length), 4);
  console.log('');
  console.log(`${'Step'.padEnd(w)}  Status   Detail`);
  console.log(`${'-'.repeat(w)}  -------  ------`);
  for (const r of results) console.log(`${r.step.padEnd(w)}  ${r.status.padEnd(7)}  ${r.detail}`);
  console.log('');
}

const steps = [stepNode, stepFolders, stepPython, stepVenv, stepKokoro, stepChrome, stepConfig, stepCatalog];
let failed = false;
console.log(`${CHECK ? 'Checking' : 'Setting up'} the reel skill in ${REEL_HOME} (${PLATFORM})`);
try {
  for (const step of steps) await step();
} catch (e) {
  failed = true;
  if (!(e instanceof Stop)) console.error(`\nSetup stopped: ${e.message}`);
}
summary();
const missing = results.some(r => r.status === 'missing');
if (failed) {
  console.log('Fix the line above, then run setup again. Finished steps will be skipped.');
  process.exit(1);
} else if (CHECK) {
  console.log(missing ? 'Some parts are missing. Run setup without --check to add them.' : 'Everything is ready.');
  process.exit(missing ? 1 : 0);
} else {
  console.log('Next step: in Claude Code, type /reel:reel (or ask Claude to make a reel).');
}
