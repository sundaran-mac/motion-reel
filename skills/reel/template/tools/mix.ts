// Builds the sound track from src/cues.ts and audio.json: music (ducked under the voice),
// the voice lines, and every sound effect at its cue time. Then muxes it with the
// rendered frames and encodes two MP4 files:
//   out/<name>.mp4       full quality (h264 CRF 16, AAC 256k)
//   out/<name>-web.mp4   under 15 MB, for a web page (CRF raised until it fits)
// A draft render gives out/<name>-draft.mp4 only. Prints loudness numbers at the end.
//
// Usage: npm run mix   (or: node --experimental-strip-types tools/mix.ts [--audio-only])
// Sound files come from the skill's library: node <skillDir>/tools/library.mjs path <id>.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {END, FPS, MUSIC, SFX, VO, type MusicPart} from '../src/cues.ts';
import {VO_DUR} from '../src/vo.ts';
import {ffmpegPath, lastRender, listFrames, readJson, reelInfo, root} from './common.mjs';

const ff = ffmpegPath();
const info = reelInfo();
const name: string = info.name;
const outDir = path.join(root, 'out');
fs.mkdirSync(outDir, {recursive: true});

// ---------------------------------------------------------------- resolve sound files

type AudioJson = {music?: {id?: string; file?: string; gain?: number; segments?: MusicPart[]}; sfx?: Record<string, string>};
const audio: AudioJson = readJson(path.join(root, 'audio.json'), {});
// Tracks differ in loudness, so the music volume can be set per video (default 0.55).
const musicGain = Number(audio.music?.gain ?? 0.55);
const cache = new Map<string, string>();
function libraryPath(id: string): string {
  // A plain file path (a track the user gave) is used as it is.
  if (fs.existsSync(id)) return path.resolve(id);
  const hit = cache.get(id);
  if (hit) return hit;
  if (!info.skillDir) throw new Error('No skill folder: set REEL_SKILL_DIR or skillDir in .reel.json');
  const lib = path.join(info.skillDir, 'tools', 'library.mjs');
  const out = execFileSync(process.execPath, [lib, 'path', id], {encoding: 'utf8'});
  const file = out.trim().split(/\r?\n/).filter(Boolean).pop() ?? '';
  if (!fs.existsSync(file)) throw new Error(`library.mjs path ${id} gave "${file}", which does not exist`);
  cache.set(id, file);
  return file;
}

const musicId = audio.music?.file ?? audio.music?.id;
const musicFile = musicId ? libraryPath(musicId) : null;
const parts: MusicPart[] = MUSIC.length ? MUSIC : audio.music?.segments?.length ? audio.music.segments : [{from: 0, at: 0, until: END}];

const sfxFile = (alias: string) => {
  const id = audio.sfx?.[alias];
  if (!id) throw new Error(`Sound "${alias}" is used in cues.ts but not listed under "sfx" in audio.json`);
  return libraryPath(id);
};

// ---------------------------------------------------------------- the filter graph

const inputs: string[] = [];
const graph: string[] = [];
const fmt = 'aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo';
const ms = (t: number) => Math.round(t * 1000);
const silence = (label: string) => {
  graph.push(`anullsrc=r=48000:cl=stereo,atrim=0:${END}[${label}]`);
  return `[${label}]`;
};
const mixDown = (labels: string[], out: string) =>
  graph.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0,apad=whole_dur=${END},atrim=0:${END}${out}`);

const voLines = VO.filter(v => {
  const ok = fs.existsSync(path.join(root, 'public', 'vo', `${v.key}.wav`));
  if (!ok) console.warn(`mix: no public/vo/${v.key}.wav, line skipped (run tools/vo.py)`);
  return ok;
});
const voLabels = [silence('vo_sil')];
voLines.forEach((v, i) => {
  inputs.push(path.join(root, 'public', 'vo', `${v.key}.wav`));
  graph.push(`[${inputs.length - 1}:a]${fmt},volume=2.3,adelay=${ms(v.at)}|${ms(v.at)}[vo${i}]`);
  voLabels.push(`[vo${i}]`);
});
mixDown(voLabels, ',asplit[vo][vokey]');

const sfxLabels = [silence('sfx_sil')];
SFX.forEach((s, i) => {
  inputs.push(sfxFile(s.sfx));
  const trim = s.max ? `,atrim=0:${s.max},afade=t=out:st=${Math.max(0, s.max - 0.2)}:d=0.2` : '';
  graph.push(`[${inputs.length - 1}:a]${fmt}${trim},volume=${s.gain},adelay=${ms(s.at)}|${ms(s.at)}[s${i}]`);
  sfxLabels.push(`[s${i}]`);
});
mixDown(sfxLabels, '[sfx]');

const musicLabels = [silence('mu_sil')];
if (musicFile) {
  parts.forEach((m, i) => {
    inputs.push(musicFile);
    const len = +(m.until - m.at).toFixed(3);
    const last = i === parts.length - 1;
    // A short fade at each join; the last part fades out with the end card.
    const outFade = last ? Math.min(2.4, len / 3) : 0.3;
    graph.push(
      `[${inputs.length - 1}:a]${fmt},atrim=${m.from}:${(m.from + len).toFixed(3)},asetpts=N/SR/TB,afade=t=in:d=0.04,` +
        `afade=t=out:st=${(len - outFade).toFixed(2)}:d=${outFade.toFixed(2)},volume=${musicGain},adelay=${ms(m.at)}|${ms(m.at)}[mu${i}]`,
    );
    musicLabels.push(`[mu${i}]`);
  });
}
mixDown(musicLabels, '[m]');
graph.push('[m][vokey]sidechaincompress=threshold=0.02:ratio=4:attack=20:release=450[mduck]');
graph.push('[mduck][vo][sfx]amix=inputs=3:normalize=0,alimiter=limit=0.94:level=false[out]');

const wav = path.join(outDir, 'mix.wav');
const script = path.join(outDir, 'mix.filter');
fs.writeFileSync(script, graph.join(';\n'));
execFileSync(ff, ['-v', 'error', '-y', ...inputs.flatMap(i => ['-i', i]), '-filter_complex_script', script, '-map', '[out]', '-ar', '48000', wav], {
  stdio: 'inherit',
});
console.log('audio ->', path.relative(root, wav));

// ---------------------------------------------------------------- video

const frames = listFrames();
const render = lastRender();
if (!process.argv.includes('--audio-only') && frames.files.length) {
  const fps = render?.fps ?? FPS;
  const first = frames.files[0];
  const digits = first.replace('.png', '').length;
  const pattern = path.join(frames.dir, `%0${digits}d.png`);
  const start = String(Number(first.replace('.png', '')));
  const range: [number, number] | null = render?.range ?? null;
  const audioIn = range ? ['-ss', String(range[0]), '-t', String(range[1] - range[0]), '-i', wav] : ['-i', wav];
  const even = 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  const encode = (file: string, crf: number, abr: string) =>
    execFileSync(
      ff,
      [
        '-v', 'error', '-y',
        '-framerate', String(fps), '-start_number', start, '-i', pattern,
        ...audioIn,
        '-vf', even,
        '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-r', String(fps),
        '-c:a', 'aac', '-b:a', abr,
        '-movflags', '+faststart', '-shortest', file,
      ],
      {stdio: 'inherit'},
    );
  const mb = (f: string) => fs.statSync(f).size / 1e6;
  if (render?.draft) {
    const draft = path.join(outDir, `${name}-draft.mp4`);
    encode(draft, 23, '160k');
    console.log(`video -> ${path.relative(root, draft)} (${mb(draft).toFixed(1)} MB, draft)`);
  } else {
    const full = path.join(outDir, `${name}.mp4`);
    encode(full, 16, '256k');
    console.log(`video -> ${path.relative(root, full)} (${mb(full).toFixed(1)} MB)`);
    const web = path.join(outDir, `${name}-web.mp4`);
    let crf = 23;
    for (;;) {
      encode(web, crf, '128k');
      if (mb(web) < 15 || crf >= 40) break;
      crf += 3;
    }
    console.log(`video -> ${path.relative(root, web)} (${mb(web).toFixed(1)} MB, CRF ${crf})`);
    if (mb(web) >= 15) console.warn('mix: the web file is still 15 MB or more');
  }
} else if (!frames.files.length) {
  console.log('mix: no frames in output/project, so audio only. Run tools/render.mjs first.');
}

// ---------------------------------------------------------------- loudness

function volume(from: number, to: number) {
  const r = spawnSync(ff, ['-hide_banner', '-ss', String(from), '-t', String(to - from), '-i', wav, '-af', 'volumedetect', '-f', 'null', '-'], {
    encoding: 'utf8',
  });
  const mean = /mean_volume:\s*(-?[\d.]+|-inf)/.exec(r.stderr)?.[1] ?? '?';
  const max = /max_volume:\s*(-?[\d.]+|-inf)/.exec(r.stderr)?.[1] ?? '?';
  return `mean ${mean} dB, max ${max} dB`;
}
type Span = [number, number];
function subtract(spans: Span[], cut: Span[]): Span[] {
  let out = spans;
  for (const [a, b] of cut) {
    out = out.flatMap(([x, y]): Span[] => {
      if (b <= x || a >= y) return [[x, y]];
      const keep: Span[] = [];
      if (a > x) keep.push([x, a]);
      if (b < y) keep.push([b, y]);
      return keep;
    });
  }
  return out;
}
const voSpans: Span[] = voLines.map(v => [v.at, v.at + (VO_DUR[v.key] ?? 2)]);
console.log('\nloudness (a person must still listen; Claude cannot hear):');
if (voSpans.length) {
  // The longest voice line: voice, music under it, and any sound effects there.
  const [a, b] = [...voSpans].sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
  console.log(`  voice (longest line) ${a.toFixed(2)}-${Math.min(b, END).toFixed(2)} s: ${volume(a, Math.min(b, END))}`);
} else console.log('  voice section: no voice lines');
if (musicFile) {
  const music: Span[] = parts.map(m => [m.at, Math.min(m.until, END)]);
  const sfxSpans: Span[] = SFX.map(s => [s.at, s.at + (s.max ?? 1)]);
  const pick = (spans: Span[]) => spans.filter(s => s[1] - s[0] >= 0.8).sort((x, y) => y[1] - y[0] - (x[1] - x[0]))[0];
  const best = pick(subtract(subtract(music, voSpans), sfxSpans)) ?? pick(subtract(music, voSpans));
  if (best) console.log(`  music only ${best[0].toFixed(2)}-${best[1].toFixed(2)} s: ${volume(best[0], best[1])}`);
  else console.log('  music only: no part without voice is 0.8 s or longer');
} else console.log('  music: none in audio.json');
