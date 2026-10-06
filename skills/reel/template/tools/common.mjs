// Small helpers shared by the tools of one video project. Node built-ins only.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

/** The video project folder (the parent of tools/). */
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function readJson(file, fallback = undefined) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Cannot read ${file}: ${e.message}`);
  }
}

/** REEL_HOME, default <home>/Reels. */
export function reelHome() {
  return process.env.REEL_HOME || path.join(os.homedir(), 'Reels');
}

/** The machine config written by setup, with env overrides on top. */
export function loadConfig() {
  const cfg = readJson(path.join(reelHome(), '.library', 'config.json'), {});
  if (process.env.REEL_PYTHON) cfg.python = process.env.REEL_PYTHON;
  if (process.env.REEL_CHROME) cfg.chrome = process.env.REEL_CHROME;
  if (process.env.REEL_KOKORO_DIR) cfg.kokoroDir = process.env.REEL_KOKORO_DIR;
  return cfg;
}

/** .reel.json in the project: name, shape, skillDir. Written by tools/new.mjs. */
export function reelInfo() {
  const info = readJson(path.join(root, '.reel.json'), {});
  info.name ??= path.basename(root);
  if (process.env.REEL_SKILL_DIR) info.skillDir = process.env.REEL_SKILL_DIR;
  return info;
}

/** SHAPE, FPS and LENGTH from src/shape.ts (the single place they are kept). */
export function readShape() {
  const src = fs.readFileSync(path.join(root, 'src', 'shape.ts'), 'utf8');
  const shape = /SHAPE\s*=\s*'([^']+)'/.exec(src)?.[1] ?? '9:16';
  const fps = Number(/FPS\s*=\s*(\d+)/.exec(src)?.[1] ?? 60);
  const length = Number(/LENGTH\s*=\s*([\d.]+)/.exec(src)?.[1] ?? 60);
  const table = readJson(path.join(root, 'src', 'shapes.json'));
  return {shape, fps, length, ...table[shape]};
}

/** The Chrome to render with: REEL_CHROME, then config.json, then ~/.cache/puppeteer. */
export function findChrome() {
  const cfg = loadConfig();
  if (cfg.chrome && fs.existsSync(cfg.chrome)) return cfg.chrome;
  const base = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome');
  if (fs.existsSync(base)) {
    const builds = fs.readdirSync(base).sort().reverse();
    for (const b of builds) {
      const candidates = [
        path.join(base, b, 'chrome-mac-arm64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(base, b, 'chrome-mac-x64', 'Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing'),
        path.join(base, b, 'chrome-win64', 'chrome.exe'),
        path.join(base, b, 'chrome-linux64', 'chrome'),
      ];
      const hit = candidates.find(p => fs.existsSync(p));
      if (hit) return hit;
    }
  }
  throw new Error(
    'No Chrome found for rendering. Run the skill setup, or set REEL_CHROME to a Chrome or Chrome for Testing executable.',
  );
}

const req = createRequire(path.join(root, 'package.json'));
export const ffmpegPath = () => req('@ffmpeg-installer/ffmpeg').path;
export const ffprobePath = () => req('@ffprobe-installer/ffprobe').path;

/** Rendered PNG frames, sorted, from output/project. */
export function listFrames() {
  const dir = path.join(root, 'output', 'project');
  if (!fs.existsSync(dir)) return {dir, files: []};
  const files = fs.readdirSync(dir).filter(f => /^\d+\.png$/.test(f)).sort();
  return {dir, files};
}

/** Settings of the last render (fps, scale, range), written by tools/render.mjs. */
export function lastRender() {
  return readJson(path.join(root, 'output', 'render.json'), null);
}

/** Read `--flag value` style arguments. */
export function argValue(args, flag, count = 1) {
  const i = args.indexOf(flag);
  if (i < 0) return undefined;
  const vals = args.slice(i + 1, i + 1 + count);
  if (vals.length < count) throw new Error(`${flag} needs ${count} value(s)`);
  return count === 1 ? vals[0] : vals;
}
