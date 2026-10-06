// A contact sheet: N frames of the video in one PNG, each labelled with its time and
// with the safe area drawn as a red box, so Claude can look at the whole reel at once.
//
// Usage: node tools/sheet.mjs [--n 12] [--cols 6] [--range <from s> <to s>] [--mp4 <file>] [--out <png>]
//   Reads output/project frames when they exist, else the MP4 in out/.
//   The last tile is always the last frame, so the end card is checked too.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {argValue, ffmpegPath, ffprobePath, lastRender, listFrames, readShape, reelInfo, root} from './common.mjs';

const args = process.argv.slice(2);
const shape = readShape();
const n = Math.max(2, Number(argValue(args, '--n') ?? 12));
const landscape = shape.w > shape.h;
const cols = Number(argValue(args, '--cols') ?? (landscape ? 4 : shape.w === shape.h ? 4 : 6));
const tileW = landscape ? 480 : shape.w === shape.h ? 400 : 300;
const range = argValue(args, '--range', 2)?.map(Number);
const ff = ffmpegPath();
const outPng = path.resolve(argValue(args, '--out') ?? path.join(root, 'out', 'sheet.png'));
fs.mkdirSync(path.dirname(outPng), {recursive: true});

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'reel-sheet-'));
const [sT, sR, sB, sL] = shape.safe;
const {w: W, h: H} = shape;
// The safe area in the frame's own pixels (frames may be half size in a draft).
const safeBox =
  `drawbox=x=iw*${sL}/${W}:y=ih*${sT}/${H}:w=iw*${W - sL - sR}/${W}:h=ih*${H - sT - sB}/${H}:color=red@0.85:t=max(2\\,iw/270)`;
const font = path.join('public', 'fonts', 'Figtree.ttf');
const hasFont = fs.existsSync(path.join(root, font));

function tile(input, seek, t, i) {
  const text = `${t.toFixed(2)} s`;
  const label = hasFont
    ? `,drawtext=fontfile=${font.split(path.sep).join('/')}:text='${text}':x=10:y=10:fontsize=28:fontcolor=white:box=1:boxcolor=black@0.7:boxborderw=6`
    : '';
  execFileSync(
    ff,
    ['-v', 'error', '-y', ...seek, '-i', input, '-frames:v', '1', '-vf', `${safeBox},scale=${tileW}:-2${label}`, path.join(tmp, `${String(i).padStart(4, '0')}.png`)],
    {cwd: root, stdio: 'inherit'},
  );
}

const frames = listFrames();
const useMp4 = args.includes('--mp4') || !frames.files.length;
const times = [];
if (!useMp4) {
  const fps = lastRender()?.fps ?? shape.fps;
  let files = frames.files;
  if (range) files = files.filter(f => {
    const t = Number(f.replace('.png', '')) / fps;
    return t >= range[0] && t <= range[1];
  });
  if (!files.length) throw new Error('sheet: no frames in that range');
  for (let i = 0; i < n; i++) {
    const f = files[Math.round((i * (files.length - 1)) / (n - 1))];
    const t = Number(f.replace('.png', '')) / fps;
    times.push(t);
    tile(path.join(frames.dir, f), [], t, i);
  }
} else {
  const name = reelInfo().name;
  const mp4 =
    argValue(args, '--mp4') ??
    [path.join(root, 'out', `${name}.mp4`), path.join(root, 'out', `${name}-draft.mp4`)].find(f => fs.existsSync(f));
  if (!mp4 || !fs.existsSync(mp4)) throw new Error('sheet: no frames in output/project and no MP4 in out/. Render first.');
  const probe = execFileSync(ffprobePath(), ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp4], {encoding: 'utf8'});
  const dur = Number(probe.trim());
  const a = range?.[0] ?? 0;
  const b = Math.min(range?.[1] ?? dur, dur) - 0.05;
  for (let i = 0; i < n; i++) {
    const t = a + ((b - a) * i) / (n - 1);
    times.push(t);
    tile(mp4, ['-ss', t.toFixed(3)], t, i);
  }
}

const rows = Math.ceil(n / cols);
execFileSync(
  ff,
  ['-v', 'error', '-y', '-framerate', '1', '-start_number', '0', '-i', path.join(tmp, '%04d.png'),
    '-vf', `tile=${cols}x${rows}:padding=8:margin=8:color=0x222222`, '-frames:v', '1', outPng],
  {stdio: 'inherit'},
);
fs.rmSync(tmp, {recursive: true, force: true});
console.log(`sheet -> ${outPng}`);
console.log(`tiles, left to right, top to bottom (s): ${times.map(t => t.toFixed(2)).join(', ')}`);
console.log('red box = safe area: text, stickers and buttons must stay inside it.');
