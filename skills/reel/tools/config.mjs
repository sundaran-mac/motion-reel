// Shared helper for the reel tools. Node built-ins only.
//
//   reelHome()            the Reels folder: env REEL_HOME, else <home>/Reels
//   libraryDir()          <reelHome>/.library
//   loadConfig()          python, chrome, kokoroDir, platform (env wins, then config.json, then fallbacks)
//   ffmpegPath(project?)  env REEL_FFMPEG, else the bundled ffmpeg inside a video project
//   platformId()          'darwin-arm64' or 'win32-x64'; throws on anything else
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export function platformId() {
  const id = `${process.platform}-${process.arch}`;
  if (id === 'darwin-arm64' || id === 'win32-x64') return id;
  throw new Error(
    `This machine (${id}) is not supported. The reel skill runs on Apple Silicon Macs (darwin-arm64) and Windows x64 (win32-x64).`,
  );
}

export function reelHome() {
  const env = process.env.REEL_HOME;
  return env ? path.resolve(env) : path.join(os.homedir(), 'Reels');
}

export function libraryDir() {
  return path.join(reelHome(), '.library');
}

function readConfigFile() {
  const file = path.join(libraryDir(), 'config.json');
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function venvPython(dir) {
  return process.platform === 'win32'
    ? path.join(dir, 'Scripts', 'python.exe')
    : path.join(dir, 'bin', 'python');
}

// Newest Chrome for Testing inside the puppeteer cache, or null.
function puppeteerChrome() {
  const root = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  let dirs;
  try {
    dirs = fs.readdirSync(root).sort().reverse();
  } catch {
    return null;
  }
  for (const d of dirs) {
    const candidates = process.platform === 'win32'
      ? [path.join(root, d, 'chrome-win64', 'chrome.exe')]
      : [path.join(root, d, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing')];
    for (const c of candidates) if (fs.existsSync(c)) return c;
  }
  return null;
}

export function loadConfig() {
  const file = readConfigFile();
  const lib = libraryDir();
  let platform = file.platform ?? null;
  if (!platform) {
    try { platform = platformId(); } catch { platform = null; }
  }
  return {
    version: file.version ?? 1,
    python: process.env.REEL_PYTHON || file.python || venvPython(path.join(lib, 'venv')),
    chrome: process.env.REEL_CHROME || file.chrome || puppeteerChrome(),
    kokoroDir: process.env.REEL_KOKORO_DIR || file.kokoroDir || path.join(lib, 'kokoro'),
    platform,
    libraryDir: lib,
    reelHome: reelHome(),
  };
}

// The ffmpeg binary. Returns null when none is found; call ffmpegPathOrExit for a clear message.
export function ffmpegPath(projectDir) {
  if (process.env.REEL_FFMPEG) return process.env.REEL_FFMPEG;
  if (projectDir) {
    let id;
    try { id = platformId(); } catch { return null; }
    const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    const file = path.join(path.resolve(projectDir), 'node_modules', '@ffmpeg-installer', id, exe);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

export const FFMPEG_MISSING =
  'ffmpeg not found. Set REEL_FFMPEG to the ffmpeg binary, or run inside a video project ' +
  'after "npm install" (it brings @ffmpeg-installer/ffmpeg).';

export function ffmpegPathOrExit(projectDir) {
  const p = ffmpegPath(projectDir);
  if (!p) {
    console.error(FFMPEG_MISSING);
    process.exit(1);
  }
  return p;
}

// Command line, so SKILL.md can ask for a path in one step:
//   node config.mjs get python|chrome|kokoro|home|library
//   node config.mjs get ffmpeg <video-project-folder>
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, what, projectDir] = process.argv.slice(2);
  if (cmd !== 'get' || !what) {
    console.error('usage: node config.mjs get python|chrome|kokoro|home|library|ffmpeg [project]');
    process.exit(1);
  }
  const cfg = what === 'ffmpeg' || what === 'home' || what === 'library' ? {} : loadConfig();
  const value = {
    python: cfg.python, chrome: cfg.chrome, kokoro: cfg.kokoroDir,
    home: reelHome(), library: libraryDir(),
    ffmpeg: what === 'ffmpeg' ? ffmpegPath(projectDir) : undefined,
  }[what];
  if (!value) {
    console.error(what === 'ffmpeg' ? FFMPEG_MISSING : `No "${what}" yet. Run setup first: node <skill>/setup.mjs`);
    process.exit(1);
  }
  console.log(value);
}
