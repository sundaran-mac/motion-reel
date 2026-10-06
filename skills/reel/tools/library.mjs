#!/usr/bin/env node
// The reel skill's audio library. Plain Node 22+, no packages.
//
//   node library.mjs catalog [--only a,b] [--music-pages N] [--sfx-pages N]
//       Reads Mixkit's public category pages and writes <library>/catalog.json.
//       The new catalog replaces the old one only when the build finishes.
//   node library.mjs pick music --mood happy,corporate [--genre g] [--tag t] [--min 60] [--max 180] [--n 5] [--json]
//   node library.mjs pick sfx --tag whoosh [--max 2] [--n 5] [--json]
//       Scores the catalog against the words asked for and prints the best matches.
//   node library.mjs fetch <id> [<id> ...]
//       Downloads into <library>/music or <library>/sfx once. A second call reuses the file.
//   node library.mjs path <id>
//       Prints only the absolute local file path, downloading first if it is missing.
//   node library.mjs info <id>
//       Prints the catalog entry as JSON.
//
// The library folder is <REEL_HOME>/.library (default <home>/Reels/.library). See config.mjs.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {libraryDir} from './config.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LIB = libraryDir();
const CATALOG = path.join(LIB, 'catalog.json');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36';
const BASE = 'https://mixkit.co';
const LICENCE = {
  music: 'Mixkit Stock Music Free License (https://mixkit.co/license/#musicFree)',
  sfx: 'Mixkit Sound Effects Free License (https://mixkit.co/license/#sfxFree)',
};
const DELAY_MS = 350; // at most one request to mixkit.co every 350 ms

const sleep = ms => new Promise(r => setTimeout(r, ms));
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && i + 1 < args.length ? args[i + 1] : def;
};
const positional = () => {
  const out = [];
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      if (!['json'].includes(args[i].slice(2))) i++; // skip the option's value
      continue;
    }
    out.push(args[i]);
  }
  return out;
};

function die(msg) {
  console.error(msg);
  process.exit(1);
}

async function get(url) {
  let last = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {headers: {'User-Agent': UA, 'Accept-Language': 'en'}});
      if (res.ok) return res.text();
      if (res.status === 404) return '';
      last = `HTTP ${res.status}`;
    } catch (e) {
      last = e.message;
    }
    await sleep(1500 * (attempt + 1));
  }
  throw new Error(`failed after 3 tries (${last}): ${url}`);
}

const decode = s => s
  .replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

// One card per item. The card carries id, preview file, title, artist, tag links and length.
// Mixkit has no page for a single item, so `page` is the category page the item was found on.
function parseCards(html, type, pageUrl) {
  const items = [];
  const re = /data-audio-player-preview-url-value="([^"]+)"\s+data-audio-player-item-id-value="(\d+)"\s+data-audio-player-item-type-value="(music|sfx)"/g;
  const starts = [...html.matchAll(re)];
  starts.forEach((m, k) => {
    const chunk = html.slice(m.index, k + 1 < starts.length ? starts[k + 1].index : m.index + 8000);
    const title = decode(chunk.match(/item-grid-card__title">\s*([^<]+)</)?.[1] ?? '');
    const author = decode(chunk.match(/__author">\s*by\s+([^<]+)</)?.[1] ?? '');
    const dur = chunk.match(/data-test-id="duration">\s*([\d:]+)/)?.[1] ?? '';
    const seconds = dur ? dur.split(':').reduce((a, b) => a * 60 + Number(b), 0) : null;
    const tags = {genre: [], mood: [], instrument: [], tag: []};
    for (const [, kind, slug] of chunk.matchAll(/href="\/free-(?:stock-music|sound-effects)\/(?:(mood|instrument|tag)\/)?([a-z0-9-]+)\/"/g)) {
      const bucket = kind ?? (type === 'music' ? 'genre' : 'tag');
      if (!tags[bucket].includes(slug)) tags[bucket].push(slug);
    }
    items.push({
      type, id: `${type}-${m[2]}`, mixkitId: Number(m[2]), title, author, seconds,
      url: m[1], page: pageUrl, tags, licence: LICENCE[type],
    });
  });
  return items;
}

async function listCategories(indexUrl, prefix) {
  const html = await get(indexUrl);
  await sleep(DELAY_MS);
  return [...new Set([...html.matchAll(new RegExp(`href="(${prefix}[a-z0-9/-]+/)"`, 'g'))].map(m => m[1]))];
}

const lastSegment = p => p.split('/').filter(Boolean).pop();

async function crawl(pages, type, maxPages) {
  const found = new Map();
  let n = 0;
  for (const p of pages) {
    for (let page = 1; page <= maxPages; page++) {
      const url = `${BASE}${p}${page > 1 ? `?page=${page}` : ''}`;
      const html = await get(url);
      const items = parseCards(html, type, `${BASE}${p}`);
      // A card shows only a few tags, so add the category the item was listed under.
      const bucket = type === 'music' ? 'mood' : 'tag';
      for (const it of items) if (!it.tags[bucket].includes(lastSegment(p))) it.tags[bucket].push(lastSegment(p));
      for (const it of items) {
        const prev = found.get(it.id);
        if (!prev) found.set(it.id, it);
        else for (const k of Object.keys(it.tags)) for (const t of it.tags[k]) if (!prev.tags[k].includes(t)) prev.tags[k].push(t);
      }
      n++;
      process.stdout.write(`${process.stdout.isTTY ? "\r" : ""}${type}: ${n} pages read, ${found.size} items${process.stdout.isTTY ? "" : "\n"}`);
      await sleep(DELAY_MS);
      if (items.length < 20) break; // last page
    }
  }
  process.stdout.write('\n');
  return [...found.values()];
}

async function catalog() {
  fs.mkdirSync(LIB, {recursive: true});
  const only = opt('only')?.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  const keep = p => !only || only.includes(lastSegment(p));
  const musicAll = await listCategories(`${BASE}/free-stock-music/`, '/free-stock-music/mood/');
  const sfxAll = (await listCategories(`${BASE}/free-sound-effects/`, '/free-sound-effects/'))
    .filter(p => p.split('/').length === 4 && !p.includes('/download/') && !p.includes('/discover/'));
  if (!musicAll.length && !sfxAll.length) die('Mixkit pages had no categories. The site may have changed. The old catalog was kept.');
  const musicPages = musicAll.filter(keep);
  const sfxPages = sfxAll.filter(keep);
  if (only) {
    const names = new Set([...musicPages, ...sfxPages].map(lastSegment));
    const missed = only.filter(o => !names.has(o));
    if (missed.length) console.log(`no Mixkit category named: ${missed.join(', ')}`);
  }
  const music = await crawl(musicPages, 'music', Number(opt('music-pages', 3)));
  const sfx = await crawl(sfxPages, 'sfx', Number(opt('sfx-pages', 2)));
  if (!music.length && !sfx.length) die('The build found no items. The old catalog was kept.');
  const data = {source: 'mixkit.co', builtAt: new Date().toISOString(), music, sfx};
  // Write a temp file, then rename: a failed build never destroys the old catalog.
  const tmp = `${CATALOG}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 1));
  fs.renameSync(tmp, CATALOG);
  console.log(`catalog: ${music.length} music tracks, ${sfx.length} sound effects -> ${CATALOG}`);
}

function load() {
  if (!fs.existsSync(CATALOG)) {
    die(
      `No audio catalog yet (${CATALOG}).\n` +
      `Run setup first: node "${path.join(HERE, '..', 'setup.mjs')}"\n` +
      `or build it alone: node "${path.join(HERE, 'library.mjs')}" catalog`,
    );
  }
  return JSON.parse(fs.readFileSync(CATALOG, 'utf8'));
}

// Score one item against the words asked for.
// Per word, the best single match counts:
//   exact tag 3 (3.5 when it sits in the bucket that was asked for, e.g. --mood happy on a mood tag)
//   a whole part of a tag ("pop" in "folk-pop") 2
//   part of a tag ("whoo" in "whoosh") 1
//   a whole title word 1, part of a title word 0.5
// Items are ranked first by how many words matched, then by score.
function scoreItem(it, want) {
  const titleWords = it.title.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  let score = 0;
  let matched = 0;
  for (const {word, bucket} of want) {
    let best = 0;
    for (const [b, list] of Object.entries(it.tags)) {
      for (const t of list) {
        if (t === word) best = Math.max(best, b === bucket ? 3.5 : 3);
        else if (t.split('-').includes(word)) best = Math.max(best, 2);
        else if (t.includes(word)) best = Math.max(best, 1);
      }
    }
    if (titleWords.includes(word)) best = Math.max(best, 1);
    else if (titleWords.some(w => w.includes(word))) best = Math.max(best, 0.5);
    if (best > 0) matched++;
    score += best;
  }
  return {score, matched};
}

function pick(type) {
  if (type !== 'music' && type !== 'sfx') die('usage: pick music|sfx --mood a,b [--tag t] [--genre g] [--min S] [--max S] [--n N] [--json]');
  const data = load();
  const want = [];
  for (const bucket of ['mood', 'tag', 'genre']) {
    for (const w of (opt(bucket, '') ?? '').split(',')) {
      const word = w.trim().toLowerCase().replace(/\s+/g, '-');
      if (word) want.push({word, bucket});
    }
  }
  if (!want.length) die('Say what to look for: --mood, --tag or --genre (comma separated words).');
  const min = Number(opt('min', 0));
  const max = Number(opt('max', Infinity));
  const n = Number(opt('n', 5));
  const scored = data[type]
    .filter(it => it.seconds == null || (it.seconds >= min && it.seconds <= max))
    .map(it => ({it, ...scoreItem(it, want)}))
    .filter(x => x.score > 0)
    .sort((a, b) => b.matched - a.matched || b.score - a.score || (a.it.seconds ?? 0) - (b.it.seconds ?? 0))
    .slice(0, n);
  if (flag('json')) {
    console.log(JSON.stringify(scored.map(({it, score, matched}) => ({
      id: it.id, title: it.title, author: it.author, seconds: it.seconds,
      score, matched, of: want.length, tags: it.tags,
      listen: it.url, page: it.page ?? pageFallback(it), licence: it.licence,
    })), null, 1));
    return;
  }
  if (!scored.length) { console.log('no match'); return; }
  for (const {it, score, matched} of scored) {
    const tags = [...it.tags.genre, ...it.tags.mood, ...it.tags.tag].slice(0, 6).join(', ');
    console.log(`${it.id.padEnd(11)} ${matched}/${want.length} words, score ${String(score).padEnd(4)} ${String(it.seconds ?? '?').padStart(4)}s  ${it.title}  [${tags}]`);
    console.log(`            listen: ${it.url}`);
  }
}

// Old catalogs (from the prototype) have no page field.
const pageFallback = it => (it.type === 'music' ? `${BASE}/free-stock-music/` : `${BASE}/free-sound-effects/`);

function findItem(data, id) {
  return [...data.music, ...data.sfx].find(it => it.id === id);
}

// Downloads one item if needed and returns its absolute file path.
// log() receives progress lines; `path` sends them to stderr so stdout stays a clean path.
async function ensureFile(it, log) {
  const dir = path.join(LIB, it.type);
  fs.mkdirSync(dir, {recursive: true});
  const file = path.join(dir, `${it.id}.mp3`);
  if (fs.existsSync(file) && fs.statSync(file).size > 1000) {
    log(`${it.id}: cached  ${file}`);
    return file;
  }
  let res;
  try {
    res = await fetch(it.url, {headers: {'User-Agent': UA}});
  } catch (e) {
    throw new Error(`${it.id}: download failed (${e.message})`);
  }
  if (!res.ok) throw new Error(`${it.id}: download failed, HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length <= 1000) throw new Error(`${it.id}: download too small (${buf.length} bytes)`);
  const tmp = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(tmp, buf);
  fs.renameSync(tmp, file);
  log(`${it.id}: downloaded ${(buf.length / 1e6).toFixed(2)} MB  ${file}`);
  await sleep(DELAY_MS);
  return file;
}

async function fetchIds(ids) {
  if (!ids.length) die('usage: fetch <id> [<id> ...]   (ids look like music-839 or sfx-1489)');
  const data = load();
  let failed = 0;
  for (const id of ids) {
    const it = findItem(data, id);
    if (!it) { console.log(`${id}: not in catalog`); failed++; continue; }
    try {
      await ensureFile(it, s => console.log(s));
    } catch (e) {
      console.log(e.message);
      failed++;
    }
  }
  if (failed) process.exitCode = 1;
}

async function pathOf(id) {
  if (!id) die('usage: path <id>');
  const it = findItem(load(), id);
  if (!it) die(`${id}: not in catalog`);
  try {
    console.log(await ensureFile(it, s => console.error(s)));
  } catch (e) {
    die(e.message);
  }
}

function info(id) {
  if (!id) die('usage: info <id>');
  const it = findItem(load(), id);
  if (!it) die(`${id}: not in catalog`);
  console.log(JSON.stringify({...it, page: it.page ?? pageFallback(it)}, null, 1));
}

const [cmd, a1] = args;
const pos = positional();
if (cmd === 'catalog') await catalog();
else if (cmd === 'pick') pick(a1);
else if (cmd === 'fetch') await fetchIds(pos);
else if (cmd === 'path') await pathOf(pos[0]);
else if (cmd === 'info') info(pos[0]);
else {
  console.log('usage: node library.mjs catalog | pick music|sfx --mood a,b | fetch <id...> | path <id> | info <id>');
  if (cmd) process.exitCode = 1;
}
