#!/usr/bin/env node
// Download free Unsplash photos by link. Plain Node 22+, no packages, no API key.
//
//   node photos.mjs fetch <unsplash photo url or id> [...] --out <dir> [--w 1600]
//       Saves <dir>/<id>.jpg for each free photo and prints a JSON list of
//       {id, file, page, status, photographer}. A paid Unsplash+ photo answers HTTP 403
//       and is reported as "paid, skipped". Results are also kept in <dir>/photos.json.
//   node photos.mjs credits <dir>
//       Prints Markdown lines for CREDITS.md: page link and "Unsplash License".
//
// The photographer name comes from the file name Unsplash gives the download
// (for example "jane-doe-<id>-unsplash.jpg"). No other page is read.
import fs from 'node:fs';
import path from 'node:path';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const LICENCE = 'Unsplash License (https://unsplash.com/license)';
const MANIFEST = 'photos.json';
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const positional = () => {
  const out = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) { i++; continue; }
    out.push(args[i]);
  }
  return out;
};
function die(msg) {
  console.error(msg);
  process.exit(1);
}

// A photo id is 11 characters of letters, digits, "_" and "-". A page link ends with
// "<slug>-<id>" or "<id>", so the id is the last 11 characters of the last path part.
export function photoId(input) {
  let s = input.trim();
  if (/^https?:\/\//i.test(s)) {
    const u = new URL(s);
    const parts = u.pathname.split('/').filter(Boolean);
    const at = parts.indexOf('photos');
    s = at >= 0 && parts[at + 1] ? parts[at + 1] : parts.pop() ?? '';
  }
  if (!/^[A-Za-z0-9_-]{11,}$/.test(s)) return null;
  return s.slice(-11);
}

function photographerFrom(location, id) {
  try {
    const dl = new URL(location).searchParams.get('dl') ?? '';
    const m = dl.match(new RegExp(`^(.+)-${id.replace(/[-_]/g, c => `\\${c}`)}-unsplash\\.jpg$`));
    if (!m) return null;
    return m[1].split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');
  } catch {
    return null;
  }
}

async function fetchOne(id, dir, w) {
  const page = `https://unsplash.com/photos/${id}`;
  const file = path.join(dir, `${id}.jpg`);
  const base = {id, file: null, page, status: '', photographer: null};
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    return {...base, file, status: 'cached'};
  }
  const url = `https://unsplash.com/photos/${id}/download?force=true&w=${w}`;
  let res;
  try {
    res = await fetch(url, {headers: {'User-Agent': UA}, redirect: 'manual'});
  } catch (e) {
    return {...base, status: `failed: ${e.message}`};
  }
  if (res.status === 403) return {...base, status: 'paid, skipped'};
  if (res.status === 404) return {...base, status: 'not found'};
  let photographer = null;
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('location');
    if (!location) return {...base, status: `failed: HTTP ${res.status} with no redirect`};
    photographer = photographerFrom(location, id);
    try {
      res = await fetch(location, {headers: {'User-Agent': UA}});
    } catch (e) {
      return {...base, status: `failed: ${e.message}`};
    }
  }
  if (!res.ok) return {...base, status: `failed: HTTP ${res.status}`};
  const type = res.headers.get('content-type') ?? '';
  if (!type.startsWith('image/')) return {...base, status: `failed: not an image (${type})`};
  const buf = Buffer.from(await res.arrayBuffer());
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  return {...base, file, photographer, status: 'downloaded'};
}

function readManifest(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, MANIFEST), 'utf8'));
  } catch {
    return [];
  }
}

async function fetchCmd() {
  const inputs = positional();
  const out = opt('out');
  if (!inputs.length || !out) die('usage: node photos.mjs fetch <unsplash photo url or id> [...] --out <dir> [--w 1600]');
  const w = Number(opt('w', 1600));
  if (!Number.isFinite(w) || w < 100) die('--w must be a width in pixels, for example 1600');
  const dir = path.resolve(out);
  fs.mkdirSync(dir, {recursive: true});
  const manifest = readManifest(dir);
  const results = [];
  for (const input of inputs) {
    const id = photoId(input);
    if (!id) { results.push({id: null, input, file: null, page: null, status: 'not an Unsplash photo link or id'}); continue; }
    const r = await fetchOne(id, dir, w);
    const old = manifest.find(m => m.id === id);
    if (r.status === 'cached' && old) r.photographer = old.photographer ?? null;
    results.push(r);
    if (r.file) {
      const entry = {id, file: path.basename(r.file), page: r.page, photographer: r.photographer, licence: LICENCE};
      if (old) Object.assign(old, entry); else manifest.push(entry);
    }
    await sleep(300);
  }
  fs.writeFileSync(path.join(dir, MANIFEST), JSON.stringify(manifest, null, 1));
  console.log(JSON.stringify(results, null, 1));
}

function creditsCmd() {
  const [dirArg] = positional();
  if (!dirArg) die('usage: node photos.mjs credits <dir>');
  const dir = path.resolve(dirArg);
  if (!fs.existsSync(dir)) die(`no such folder: ${dir}`);
  const manifest = readManifest(dir);
  const known = new Set(manifest.map(m => m.id));
  // Photos saved without the manifest still get a line, from their file name.
  for (const f of fs.readdirSync(dir).filter(f => /\.jpg$/i.test(f)).sort()) {
    const id = f.replace(/\.jpg$/i, '');
    if (!known.has(id) && /^[A-Za-z0-9_-]{11}$/.test(id)) {
      manifest.push({id, file: f, page: `https://unsplash.com/photos/${id}`, photographer: null, licence: LICENCE});
    }
  }
  for (const m of manifest) {
    if (!fs.existsSync(path.join(dir, m.file))) continue;
    const by = m.photographer ? ` by ${m.photographer}` : '';
    console.log(`- Photo \`${m.file}\`${by}: ${m.page} (Unsplash License)`);
  }
}

const cmd = args[0];
if (cmd === 'fetch') await fetchCmd();
else if (cmd === 'credits') creditsCmd();
else {
  console.log('usage: node photos.mjs fetch <url or id...> --out <dir> [--w 1600] | credits <dir>');
  if (cmd) process.exitCode = 1;
}
