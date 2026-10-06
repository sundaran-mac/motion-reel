# Reel template API

This is the only description of `src/layout.ts`, `src/lib.ts`, `src/cues.ts` and the tools.
`src/scenes/main.tsx` is a working sample that uses every part. Read it next to this page.

Coordinates are Motion Canvas coordinates: `(0, 0)` is the centre of the frame, x grows
right, y grows down. Times are seconds.

## Files in a video project

| File | What it holds | Who writes it |
|---|---|---|
| `src/shape.ts` | `SHAPE`, `FPS`, `LENGTH` | `tools/new.mjs` (edit by hand to change) |
| `src/shapes.json` | size, safe area and zone split per shape | template (shared by layout, new, sheet) |
| `src/theme.ts` | colours `C`, background `BLOBS`, `FONT` | you |
| `src/cues.ts` | the one timeline: `S`, `T`, `VO`, `SFX`, `MUSIC`, `END` | you |
| `src/vo.ts` | `VO_DUR`: seconds per voice line | `tools/vo.py` |
| `vo.json` | voice lines, `{"key": "text"}` | you |
| `audio.json` | music id and sound aliases | you (ids from the skill library) |
| `src/scenes/main.tsx` | the scene | you |
| `.reel.json` | name, shape, skill folder | `tools/new.mjs` |

Import local files with the `.ts` extension (`'../cues.ts'`): `tools/mix.ts` runs
`cues.ts` in Node, which needs it.

## layout.ts: place by zone, never by pixels

```ts
import {W, H, ORIENT, SIDE, u, Z, SAFE, FRAME, union, inset, zone} from '../layout.ts';
```

- `W`, `H`: frame size. `ORIENT`: `'portrait'` (9:16, 4:5), `'landscape'` (16:9), `'square'` (1:1).
- `SIDE`: `true` in 16:9 and 1:1. The stage sits left and the text column right.
- `u(n)`: scales a size from the 1080 x 1920 design. Use it for every font size, gap and
  stroke you write as a number.
- `SAFE`: the safe area. Platform buttons cover what is outside it. No text, sticker or
  button goes outside. `FRAME` is the whole frame, for backgrounds.
- `Z.full` (= `SAFE`), `Z.title`, `Z.stage`, `Z.caption`, `Z.footer`. The four named zones never
  overlap. Portrait: title, stage, caption, footer from top to bottom. 16:9 and 1:1: stage
  on the left; title, caption, footer from top to bottom in the right column.
- A `Zone` has `x`, `y` (centre), `w`, `h`, `top`, `bottom`, `left`, `right`.
- `union(a, b, ...)`: the smallest zone around them. `inset(z, by)`: smaller on every side.
  `zone(left, top, right, bottom)`: make one.

```ts
// Phone big in portrait (stage plus the bands under it), left in 16:9 and 1:1.
const phoneZone = SIDE ? Z.stage : union(Z.stage, Z.caption, Z.footer);
const capZone = SIDE ? union(Z.title, Z.caption) : Z.title;
```

## cues.ts: the one timeline

```ts
export const BEAT = 0.5;          // seconds per beat; tools/beats.py in the skill gives it
export const B0 = 0;              // time of the first beat
beat(k)                           // B0 + k * BEAT, rounded
vo('hook', 2.5)                   // length of a voice line, or the fallback before vo.py ran
export const S = {hook: 0, logo: beat(7), ...};     // section starts, on beats
export const T = {logoIn: S.logo + 0.1, ...};       // every named moment
export const END = beat(44);      // video length
export const VO = [{key: 'hook', at: 0.45}];        // key = vo.json key = public/vo/<key>.wav
export const SFX = [{sfx: 'pop', at: T.logoIn, gain: 0.45, max: 1.5}];  // sfx = audio.json alias
export const MUSIC = [{from: 14.69, at: S.logo, until: END}];
```

- The scene waits with `yield* at(T.logoIn)`; `mix.ts` places sound at the same `T` time.
- To fit voice, make a section at least as long as its line: `phone2: S.phone + vo('b1') + 0.6`,
  then round to a beat if the music matters there.
- `MUSIC` parts: `from` is the time in the track, `at` the time in the video, `until` where
  the part ends in the video. Each join gets a short fade; the last part fades out over up
  to 2.4 s. Leave `MUSIC` empty to use `audio.json` `music.segments`; with neither, the
  track plays from 0 for the whole video.
- `audio.json`:

  ```json
  {"music": {"id": "music-158"}, "sfx": {"whoosh": "sfx-2605", "pop": "sfx-2571", "lock": "sfx-2854"}}
  ```

  `music.file` (a path) may replace `music.id` for a track the user gave.
  `music.gain` (default 0.55) sets the music volume. Tracks differ: raise it when the mix
  reports music-only more than about 3 dB under the voice.

## lib.ts: the parts

All motion follows one feel: pops use `softBack` (a small overshoot), slides use cubic
eases, and words rise, fade and settle one by one.

### Timing and text

- `at(t)`: wait until absolute time `t`. Use only times from `cues.ts`.
- `loadFonts()`: call first in the scene, so no frame uses a fallback font.
- `makeText(parent, text, opts)` returns `{root, words, size, height, ...}`. `"\n"` forces a
  line break. Options: `zone` (centre on it, wrap at its width, shrink until it fits),
  `x`, `y`, `size`, `weight`, `color`, `maxWidth`, `lineHeight`, `letterSpacing`,
  `align: 'left'`, and `accent` to colour single words: `{happen: C.accentDeep}`.
- `reveal(block.words, stagger?, dur?)`: show the words. `conceal(block.root)`: lift and remove.
- `captions(parent, zone, {size?})` gives `{show(step, text), clear()}`. `show` hides the
  caption before it, so two captions are never on screen at once. `step` is the small label
  above (`'01  ·  PLAN'`), or `''`.

```ts
const hook = makeText(stage, 'Plans fall apart\nin the group chat.', {zone: Z.full, size: u(84), weight: 800});
yield* reveal(hook.words, 0.07, 0.7);
```

### Pops and effects

- `popIn(node, dur?)`, `popOut(node, dur?)`.
- `burst(parent, x, y, colors, count?, dist?, size?)`: dots fly out and fade.
- `ring(parent, x, y, color, fromSize, toSize, width?)`: a ring grows and fades.
- `card({x, y, w, h, r?, fill?})`: a white rounded card with a soft shadow.
- `label(text, size, color, weight?, props?)`: one plain line of text.
- `ICONS.heart | sparkle | plane | phone | check`: path data about 100 units wide.
- `sticker(parent, {text, x, y, color?, textColor?, icon?, size?})`: a pill, hidden until
  `popIn`. To cross a device edge on purpose, place it on `ph.edge('right', 0.78)`. Never
  leave a sticker sitting on the frame by accident.

### Backgrounds

- `backdrop(view, clock)`: soft drifting colour blobs (`BLOBS`). `clock` runs 0 to `END`:

  ```ts
  const clock = createSignal(0);
  spawn(clock(END, END, linear));
  ```

- `darkLayer(view, clock)` gives `{node, reveal(dur?, x?, y?), cover(dur?)}`. It starts dark
  over everything. `reveal` opens a growing hole to the light layer; `cover` brings the dark
  back. Add scene content to a node added after it, so it stays on top.

### The phone

```ts
const ph = phone(stage, {zone: phoneZone});
yield* ph.show(screenList(), 'cut');           // first screen, no motion
spawn(ph.enter());                             // rises in with a soft overshoot
spawn(ph.show('/screens/02.png', 'slide', {height: 2400, contentHeight: 2010}));
spawn(ph.scroll(1.2));                         // stops at the end of the real content
yield* ph.exit();
```

- Screens are drawn in screen units: `SCREEN_W` 640 wide, `SCREEN_H` 1390 tall. The phone
  scales itself to fit its zone in any shape.
- `show(content, mode, {height, contentHeight})`: `content` is an image path or a Node.
  `mode` is `'slide'` (from the right), `'up'` (from below) or `'cut'`. `height` is the
  page height at 640 wide. For a tall export, give `contentHeight` (where the real content
  ends): `scroll` never goes past it, so a white tail is never shown.
- `screenPage(height?, fill?)`: a blank page centred on (0, 0) to draw a screen on.
- `edge(side, t)`: a point on the outer edge (`t` 0 to 1 along it). `point(sx, sy)`: a screen
  point in the parent's coordinates. Both use the phone's resting place.
- Also returns `node` (move or rotate it), `screen`, `scale`, `width`, `height`.

### Photo cards

```ts
const a = photoCard(stage, {x, y, w, h, rot: -5, src: '/photos/joy.jpg', color: C.accent, chip: 'Joy', icon: ICONS.sparkle});
spawn(a.slideIn());   // slides in tilted, then zooms slowly for 4 s
spawn(a.popChip());   // the chip on the bottom edge
yield* a.exit();
```

No photo: pass `fill` and optionally `content` (a Node drawn around (0, 0)) instead of `src`.

### End card

```ts
const end = endCard(stage, {logo: logoNode, name: 'Your App', tagline: 'Plans that actually happen.',
  accent: {happen: C.accentDeep}});          // or url: 'yourapp.com', or pills: [['Get it on', 'Google Play']]
yield* at(T.endLogo); spawn(end.showLogo());
yield* at(T.links);   spawn(end.showLinks());
yield* at(END);       // the last frame is the finished end card: no fade out
```

It uses `Z.full` and scales itself to fit every shape.

## Tools (run in the video folder)

| Command | What it does |
|---|---|
| `<python> tools/vo.py [--voice af_heart] [--speed 1.0] [--only k1,k2]` | voice lines from `vo.json` to `public/vo/*.wav` and `src/vo.ts` |
| `node tools/render.mjs --draft` | 15 fps, half size, to `output/project` |
| `node tools/render.mjs --draft --range 10 14` | only 10 to 14 s |
| `node tools/render.mjs` | full quality at `FPS` |
| `node tools/sheet.mjs [--n 12] [--range a b] [--mp4 file] [--out png]` | contact sheet with times and the safe area in red, to `out/sheet.png` |
| `npm run mix` | sound and video to `out/<name>.mp4` and `out/<name>-web.mp4` (under 15 MB), or `out/<name>-draft.mp4` after a draft; prints loudness |

`vo.py` finds the model in `--model-dir`, else `REEL_KOKORO_DIR`, else
`<REEL_HOME>/.library/kokoro`. `render.mjs` finds Chrome in `REEL_CHROME`, else
`<REEL_HOME>/.library/config.json`, else `~/.cache/puppeteer`. `mix.ts` resolves sound ids
with `node <skillDir>/tools/library.mjs path <id>`; `skillDir` comes from `REEL_SKILL_DIR`,
else `.reel.json`.
