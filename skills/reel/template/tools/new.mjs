// Makes a new video project from this template.
// Usage: node tools/new.mjs <name> [--shape 9:16|16:9|4:5|1:1] [--fps 60] [--length 60]
// The project goes to <REEL_HOME>/<name>/ (REEL_HOME defaults to <home>/Reels).
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const template = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = path.resolve(template, '..');
const FONT_URL = 'https://github.com/google/fonts/raw/main/ofl/figtree/Figtree%5Bwght%5D.ttf';

function fail(msg) {
  console.error(`new: ${msg}`);
  process.exit(1);
}

const args = process.argv.slice(2);
const opt = (flag, def) => {
  const i = args.indexOf(flag);
  if (i < 0) return def;
  const v = args[i + 1];
  if (!v || v.startsWith('--')) fail(`${flag} needs a value`);
  args.splice(i, 2);
  return v;
};
const shape = opt('--shape', '9:16');
const fps = Number(opt('--fps', '60'));
const length = Number(opt('--length', '60'));
const name = args[0];

const platform = `${process.platform}-${process.arch}`;
if (!['darwin-arm64', 'win32-x64'].includes(platform)) {
  fail(`this machine is ${platform}. The reel skill supports Apple Silicon Macs (darwin-arm64) and Windows x64 only.`);
}
if (!name || !/^[a-z0-9][a-z0-9-]{0,60}$/.test(name)) {
  fail('give a name of lowercase letters, digits and hyphens, for example: node tools/new.mjs spring-launch');
}
const shapes = JSON.parse(fs.readFileSync(path.join(template, 'src', 'shapes.json'), 'utf8'));
if (!shapes[shape]) fail(`unknown shape ${shape}. Use one of: ${Object.keys(shapes).join(', ')}`);
if (![24, 25, 30, 50, 60].includes(fps)) fail('fps must be 24, 25, 30, 50 or 60');
if (!(length > 0 && length <= 600)) fail('length must be between 1 and 600 seconds');

const home = process.env.REEL_HOME || path.join(os.homedir(), 'Reels');
const dest = path.join(home, name);
if (fs.existsSync(dest)) fail(`${dest} already exists. Pick another name, or work in that folder.`);

// 1. Copy the template, leaving out installs, renders and per-video files.
const skip = new Set(['node_modules', 'output', 'out', '.reel.json', 'output-editor.png', '.DS_Store', 'Thumbs.db']);
fs.mkdirSync(home, {recursive: true});
fs.cpSync(template, dest, {
  recursive: true,
  filter: src => {
    const rel = path.relative(template, src);
    if (!rel) return true;
    const parts = rel.split(path.sep);
    if (parts.some(p => skip.has(p))) return false;
    if (parts[0] === 'public' && parts[1] === 'fonts' && src.endsWith('.ttf')) return false;
    if (parts[0] === 'public' && parts[1] === 'vo' && parts[2] && parts[2] !== '.gitkeep') return false;
    return true;
  },
});
console.log(`made ${dest}`);

// 2. The shape, frame rate and length, and the editor's project settings.
fs.writeFileSync(
  path.join(dest, 'src', 'shape.ts'),
  `// Written by tools/new.mjs. The shape, frame rate and target length of this video.
export const SHAPE = '${shape}' as '9:16' | '16:9' | '4:5' | '1:1';
export const FPS = ${fps};
export const LENGTH = ${length};
`,
);
const s = shapes[shape];
const meta = {
  version: 1,
  shared: {background: 'rgb(251,249,243)', range: [0, null], size: {x: s.w, y: s.h}, audioOffset: 0},
  preview: {fps: 30, resolutionScale: 0.5},
  rendering: {
    fps,
    resolutionScale: 1,
    colorSpace: 'srgb',
    exporter: {name: '@motion-canvas/core/image-sequence', options: {fileType: 'image/png', quality: 100, groupByScene: false}},
  },
};
fs.writeFileSync(path.join(dest, 'src', 'project.meta'), JSON.stringify(meta, null, 2));
const pkgPath = path.join(dest, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.name = name;
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
fs.writeFileSync(
  path.join(dest, '.reel.json'),
  JSON.stringify({name, shape, fps, length, skillDir, created: new Date().toISOString().slice(0, 10)}, null, 2) + '\n',
);

// 3. The font. It is downloaded per video, never committed.
const fontPath = path.join(dest, 'public', 'fonts', 'Figtree.ttf');
try {
  const res = await fetch(FONT_URL, {redirect: 'follow'});
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  fs.writeFileSync(fontPath, Buffer.from(await res.arrayBuffer()));
  console.log('font: Figtree downloaded');
} catch (e) {
  console.warn(`font: download failed (${e.message}). Put a Figtree TTF at ${fontPath} before rendering.`);
}

// 4. Install packages. On Windows npm is npm.cmd, which Node can only start through a shell.
const win = process.platform === 'win32';
console.log('npm install (about a minute the first time) ...');
const npm = spawnSync(win ? 'npm.cmd' : 'npm', ['install', '--no-audit', '--no-fund', '--loglevel=error'], {
  cwd: dest,
  stdio: 'inherit',
  shell: win,
});
if (npm.status !== 0) fail(`npm install failed (exit ${npm.status}). Fix the error above, then run npm install in ${dest}.`);

// 5. Finish what blocked install scripts skip: esbuild's binary, and executable bits on Mac.
const esbuildInstall = path.join(dest, 'node_modules', 'esbuild', 'install.js');
if (fs.existsSync(esbuildInstall)) {
  const r = spawnSync(process.execPath, [esbuildInstall], {cwd: path.dirname(esbuildInstall), stdio: 'inherit'});
  if (r.status !== 0) console.warn('esbuild install.js failed; vite may not start.');
}
if (process.platform === 'darwin') {
  for (const bin of [
    path.join(dest, 'node_modules', '@ffmpeg-installer', 'darwin-arm64', 'ffmpeg'),
    path.join(dest, 'node_modules', '@ffprobe-installer', 'darwin-arm64', 'ffprobe'),
  ]) {
    if (fs.existsSync(bin)) fs.chmodSync(bin, 0o755);
  }
}

console.log(`
Ready: ${dest}  (${shape}, ${fps} fps, target ${length} s)

Next:
  1. Write the voice lines in vo.json, then make the audio:
       <python> tools/vo.py            (python from <REEL_HOME>/.library/config.json)
  2. Edit src/cues.ts (timeline), audio.json (music and sound ids), src/scenes/main.tsx.
  3. Check:   node tools/render.mjs --draft   then   node tools/sheet.mjs
  4. Final:   node tools/render.mjs   then   npm run mix
  API.md describes layout.ts, lib.ts and cues.ts.
`);
