// Renders the Motion Canvas project with no clicks: starts Vite, opens the editor in a
// hidden Chrome, presses Render, and waits until the editor is done. Frames go to
// output/project/*.png, and output/render.json records how they were made.
//
// Usage: node tools/render.mjs [--draft] [--range <from s> <to s>]
//   --draft   15 fps at half size, for a quick check
//   --range   render only that part of the timeline, in seconds
import {createServer} from 'vite';
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import {argValue, findChrome, readShape, root} from './common.mjs';

const args = process.argv.slice(2);
const draft = args.includes('--draft');
const range = argValue(args, '--range', 2)?.map(Number);
if (range && (range.some(n => !Number.isFinite(n)) || range[1] <= range[0])) {
  console.error('render: --range needs two numbers, from and to, in seconds');
  process.exit(1);
}
const shape = readShape();
const fps = draft ? 15 : shape.fps;
const scale = draft ? 0.5 : 1;

const metaPath = path.join(root, 'src', 'project.meta');
const saved = fs.readFileSync(metaPath, 'utf8');
const meta = JSON.parse(saved);
meta.rendering.fps = fps;
meta.rendering.resolutionScale = scale;
meta.shared.range = range ?? [0, null];
meta.shared.size = {x: shape.w, y: shape.h};

const outDir = path.join(root, 'output');
fs.rmSync(outDir, {recursive: true, force: true});

const exe = findChrome();
let server;
let browser;
const restore = () => fs.writeFileSync(metaPath, saved);
process.on('SIGINT', () => {
  restore();
  process.exit(130);
});
try {
  fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2));
  server = await createServer({root, server: {port: 9123, strictPort: false}, logLevel: 'warn'});
  await server.listen();
  const url = server.resolvedUrls?.local?.[0] ?? 'http://localhost:9123/';
  browser = await puppeteer.launch({executablePath: exe, headless: true, args: ['--window-size=1600,1000']});
  const page = await browser.newPage();
  await page.setViewport({width: 1600, height: 1000});
  page.on('console', m => {
    const t = m.text();
    if (/error|fail/i.test(t)) console.log('[page]', t);
  });
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  await page.goto(url, {waitUntil: 'networkidle0', timeout: 120000});
  await new Promise(r => setTimeout(r, 3000));

  // Open the rendering tab if it is not open, then press the Render button.
  const clickByText = async text =>
    page.evaluate(t => {
      const els = [...document.querySelectorAll('button, [role=button], div')];
      const el = els.find(e => e.textContent?.trim() === t && e.offsetParent !== null);
      if (el) {
        el.click();
        return true;
      }
      return false;
    }, text);
  let ok = (await clickByText('RENDER')) || (await clickByText('Render'));
  if (!ok) {
    await page.evaluate(() => {
      const tab = [...document.querySelectorAll('[title]')].find(e => /video settings|rendering/i.test(e.getAttribute('title')));
      tab?.click();
    });
    await new Promise(r => setTimeout(r, 800));
    ok = (await clickByText('RENDER')) || (await clickByText('Render'));
  }
  if (!ok) {
    await page.screenshot({path: path.join(root, 'output-editor.png')});
    throw new Error('Render button not found. See output-editor.png');
  }
  console.log(`render started: ${draft ? 'draft' : 'final'}, ${fps} fps, ${shape.w * scale}x${shape.h * scale}${range ? `, ${range[0]}-${range[1]} s` : ''}`);
  const t0 = Date.now();
  let last = -1;
  // Done when no Abort button is left and frames exist.
  let n = 0;
  for (;;) {
    await new Promise(r => setTimeout(r, 3000));
    n = fs.existsSync(outDir) ? fs.readdirSync(outDir, {recursive: true}).filter(f => String(f).endsWith('.png')).length : 0;
    if (n !== last) {
      console.log(`frames ${n}  ${Math.round((Date.now() - t0) / 1000)}s`);
      last = n;
    }
    const busy = await page.evaluate(() => [...document.querySelectorAll('button')].some(b => /abort/i.test(b.textContent ?? '')));
    if (!busy && n > 0) break;
    if (Date.now() - t0 > 3 * 3600 * 1000) throw new Error('render timeout');
  }
  fs.writeFileSync(
    path.join(outDir, 'render.json'),
    JSON.stringify({fps, scale, width: shape.w * scale, height: shape.h * scale, range: range ?? null, frames: n, draft}, null, 2),
  );
  console.log(`render finished: ${n} frames in output${path.sep}project`);
} finally {
  await browser?.close();
  await server?.close();
  restore();
}
