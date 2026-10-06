// The reusable parts of a reel. Every size goes through u() from layout.ts, every colour
// comes from theme.ts, and every motion keeps the same feel: a soft back ease for pops,
// a cubic ease for slides, and words that rise, fade and settle one by one.
// API.md describes every export with a short example.
import {Circle, Img, Node, Path, Rect, Txt, blur} from '@motion-canvas/2d';
import {
  all,
  delay,
  easeInCubic,
  easeInOutCubic,
  createEaseOutBack,
  easeOutCubic,
  linear,
  sequence,
  spawn,
  useRandom,
  useTime,
  waitFor,
  type SimpleSignal,
} from '@motion-canvas/core';
import {FRAME, H, W, Z, u, type Zone} from './layout.ts';
import {BLOBS, C, FONT} from './theme.ts';

export {C, FONT};

// ---------------------------------------------------------------- timing

/** Wait until an absolute time on the timeline (seconds). Use it with times from cues.ts. */
export function* at(t: number) {
  const now = useTime();
  if (t > now) yield* waitFor(t - now);
}

/** A soft overshoot, smaller than the default back ease. */
export const softBack = createEaseOutBack(1.15);

/** Load the font weights before the first frame, so nothing flashes in a fallback face. */
export function* loadFonts(weights = [500, 600, 700, 800]) {
  for (const w of weights) yield document.fonts.load(`${w} 64px ${FONT}`);
}

// ---------------------------------------------------------------- text

let ctx: CanvasRenderingContext2D | null = null;
/** Width of a text in pixels, measured with a canvas in the real font. */
export function measure(text: string, size: number, weight: number) {
  ctx ??= document.createElement('canvas').getContext('2d');
  ctx!.font = `${weight} ${size}px ${FONT}`;
  return ctx!.measureText(text).width;
}

export type Word = {holder: Node; txt: Txt; x: number; w: number; line: number};
export type TextOpts = {
  /** Fit the text in this zone: centre on it, wrap at its width, shrink until it fits its height. */
  zone?: Zone;
  x?: number;
  y?: number;
  size?: number;
  weight?: number;
  color?: string;
  maxWidth?: number;
  lineHeight?: number;
  /** Colour for single words, by the word without punctuation: {free: C.accent}. */
  accent?: Record<string, string>;
  letterSpacing?: number;
  align?: 'center' | 'left';
};
export type TextBlock = {root: Node; words: Word[]; lineHeight: number; top: number; size: number; height: number};

function layoutLines(text: string, size: number, weight: number, maxW: number, ls: number) {
  const space = measure(' ', size, weight) + ls;
  const lines: {t: string; w: number}[][] = [];
  for (const forced of text.split('\n')) {
    let cur: {t: string; w: number}[] = [];
    let curW = 0;
    for (const t of forced.split(' ').filter(Boolean)) {
      const w = measure(t, size, weight) + ls * t.length;
      const add = cur.length ? space + w : w;
      if (cur.length && curW + add > maxW) {
        lines.push(cur);
        cur = [];
        curW = 0;
      }
      curW += cur.length ? space + w : w;
      cur.push({t, w});
    }
    if (cur.length) lines.push(cur);
  }
  const widest = Math.max(0, ...lines.map(l => l.reduce((s, w) => s + w.w, 0) + space * (l.length - 1)));
  return {lines, space, widest};
}

/**
 * Lays text out word by word. A "\n" forces a new line. Each word sits in its own holder
 * so it can rise, fade and settle on its own; call reveal(block.words) to show it.
 * With `zone`, the text is centred on the zone and shrinks until it fits inside it.
 */
export function makeText(parent: Node, text: string, o: TextOpts = {}): TextBlock {
  let size = o.size ?? u(64);
  const weight = o.weight ?? 600;
  const ls = o.letterSpacing ?? 0;
  const maxW = o.maxWidth ?? o.zone?.w ?? Z.full.w;
  const lhRatio = o.lineHeight ? o.lineHeight / size : 1.22;
  let fit = layoutLines(text, size, weight, maxW, ls);
  // Shrink until the block fits the zone: no line wider than the zone, no block taller.
  for (let i = 0; i < 40; i++) {
    const tooTall = o.zone && fit.lines.length * size * lhRatio > o.zone.h;
    const tooWide = fit.widest > maxW + 0.5;
    if (!tooTall && !tooWide) break;
    size *= 0.94;
    fit = layoutLines(text, size, weight, maxW, ls);
  }
  const {lines, space} = fit;
  const lh = size * lhRatio;
  const root = new Node({x: o.x ?? o.zone?.x ?? 0, y: o.y ?? o.zone?.y ?? 0});
  parent.add(root);
  const words: Word[] = [];
  const top = -((lines.length - 1) * lh) / 2;
  lines.forEach((line, li) => {
    const total = line.reduce((s, w) => s + w.w, 0) + space * (line.length - 1);
    let x = o.align === 'left' ? -maxW / 2 : -total / 2;
    for (const {t, w} of line) {
      const clean = t.replace(/[.,:;!?'"]/g, '');
      const txt = new Txt({
        text: t,
        fontFamily: FONT,
        fontSize: size,
        fontWeight: weight,
        letterSpacing: ls,
        fill: o.accent?.[clean] ?? o.color ?? C.ink,
        offset: [-1, 0],
        y: size * 0.53,
        scale: 0.96,
        opacity: 0,
      });
      const holder = new Node({x, y: top + li * lh});
      holder.add(txt);
      root.add(holder);
      words.push({holder, txt, x, w, line: li});
      x += w + space;
    }
  });
  return {root, words, lineHeight: lh, top, size, height: lines.length * lh};
}

/** Words rise, fade in and settle, one after another. */
export function* reveal(words: Word[], stagger = 0.055, dur = 0.6) {
  yield* all(
    ...words.map((w, i) =>
      delay(
        i * stagger,
        all(w.txt.opacity(1, dur * 0.8, easeOutCubic), w.txt.y(0, dur, easeOutCubic), w.txt.scale(1, dur, easeOutCubic)),
      ),
    ),
  );
}

/** Fade a block up and away, then remove it. */
export function* conceal(root: Node, dur = 0.35) {
  yield* all(root.opacity(0, dur, easeInCubic), root.y(root.y() - u(40), dur, easeInCubic));
  root.remove();
}

/**
 * One caption slot. show() hides the caption that was there, so two captions are never
 * on screen at once. `step` is the small spaced label above ("01  ·  PLAN"); it may be ''.
 */
export function captions(parent: Node, z: Zone, o: {color?: string; stepColor?: string; size?: number} = {}) {
  let parts: Node[] = [];
  const stepSize = u(28);
  // Not a generator on purpose: the old parts are taken now, not when the task first runs.
  function clear(dur = 0.25) {
    const old = parts;
    parts = [];
    return all(...old.map(p => conceal(p, dur)));
  }
  function* show(step: string, text: string) {
    spawn(clear());
    // The caption fits the zone below room for the step label; the label then sits
    // just above the caption, so the two read as one block in any zone height.
    const room = step ? stepSize * 1.9 : 0;
    const body = {...z, top: z.top + room, h: z.h - room, y: z.y + room / 2};
    const cap = makeText(parent, text, {zone: body, size: o.size ?? u(54), weight: 700, color: o.color ?? C.ink});
    let stepBlock: TextBlock | null = null;
    if (step) {
      const capTop = cap.root.y() + cap.top - cap.size * 0.6;
      stepBlock = makeText(parent, step, {
        x: z.x, y: capTop - stepSize * 0.9, size: stepSize, weight: 600,
        color: o.stepColor ?? C.accentDeep, letterSpacing: u(4), maxWidth: z.w,
      });
    }
    parts = stepBlock ? [stepBlock.root, cap.root] : [cap.root];
    yield* delay(0.22, all(stepBlock ? reveal(stepBlock.words, 0.03, 0.5) : waitFor(0), delay(0.1, reveal(cap.words, 0.045, 0.6))));
  }
  return {show, clear};
}

// ---------------------------------------------------------------- pops and effects

/** Scale and fade in with a soft overshoot. */
export function* popIn(n: Node, dur = 0.55) {
  n.scale(0);
  n.opacity(0);
  yield* all(n.scale(1, dur, softBack), n.opacity(1, dur * 0.5));
}

export function* popOut(n: Node, dur = 0.3) {
  yield* all(n.scale(0.6, dur, easeInCubic), n.opacity(0, dur, easeInCubic));
}

/** Small dots that fly out from a point and fade. Sizes are in final pixels: pass u(...). */
export function* burst(parent: Node, x: number, y: number, colors: string[], count = 14, dist = u(220), size = u(18)) {
  const rnd = useRandom(Math.round(x * 13 + y * 7 + count));
  const dots = Array.from({length: count}, (_, i) => {
    const d = new Circle({x, y, size: rnd.nextFloat(size * 0.5, size), fill: colors[i % colors.length], opacity: 0.95});
    parent.add(d);
    return d;
  });
  yield* all(
    ...dots.map((d, i) => {
      const a = (i / count) * Math.PI * 2 + rnd.nextFloat(-0.25, 0.25);
      const r = dist * rnd.nextFloat(0.6, 1.1);
      return all(
        d.position([x + Math.cos(a) * r, y + Math.sin(a) * r], 0.9, easeOutCubic),
        d.opacity(0, 0.9, easeInCubic),
        d.scale(0.3, 0.9, easeInCubic),
      );
    }),
  );
  dots.forEach(d => d.remove());
}

/** An expanding ring that fades: the glow behind a pop. */
export function* ring(parent: Node, x: number, y: number, color: string, from: number, to: number, width = u(6)) {
  const r = new Circle({x, y, size: from, stroke: color, lineWidth: width, opacity: 0.7});
  parent.add(r);
  yield* all(r.size(to, 0.9, easeOutCubic), r.opacity(0, 0.9, easeOutCubic), r.lineWidth(1, 0.9));
  r.remove();
}

// ---------------------------------------------------------------- simple shapes

/** A white rounded card with a soft shadow. */
export function card(p: {x?: number; y?: number; w: number; h: number; r?: number; fill?: string}) {
  return new Rect({
    x: p.x ?? 0,
    y: p.y ?? 0,
    width: p.w,
    height: p.h,
    radius: p.r ?? u(36),
    fill: p.fill ?? C.card,
    shadowColor: 'rgba(26,23,20,0.16)',
    shadowBlur: u(50),
    shadowOffsetY: u(18),
  });
}

/** One line of text, no animation. */
export function label(text: string, size: number, color: string, weight = 600, props: Record<string, unknown> = {}) {
  return new Txt({text, fontFamily: FONT, fontSize: size, fontWeight: weight, fill: color, ...props});
}

/** Path data for small icons, drawn about 100 units across. Scale them with `scale`. */
export const ICONS = {
  heart:
    'M0 34 C -6 28 -46 2 -46 -22 C -46 -38 -34 -50 -20 -50 C -10 -50 -3 -44 0 -37 C 3 -44 10 -50 20 -50 C 34 -50 46 -38 46 -22 C 46 2 6 28 0 34 Z',
  sparkle: 'M0 -52 C 6 -14 14 -6 52 0 C 14 6 6 14 0 52 C -6 14 -14 6 -52 0 C -14 -6 -6 -14 0 -52 Z',
  plane: 'M -50 -6 L 52 -42 L 18 46 L 4 12 Z M 4 12 L 52 -42',
  phone:
    'M -26 -34 C -30 -34 -36 -28 -34 -20 C -28 6 -6 28 20 34 C 28 36 34 30 34 26 L 34 14 C 34 10 30 8 26 8 L 14 6 C 10 6 8 8 6 12 C -4 8 -10 2 -14 -8 C -10 -10 -8 -12 -8 -16 L -10 -28 C -10 -32 -14 -34 -18 -34 Z',
  check: 'M -30 0 L -9 22 L 32 -22',
};

/**
 * A pill with an optional icon and a short text. It starts hidden: show it with popIn().
 * To make it straddle a device edge on purpose, place it at phone.edge('right', 0.3).
 */
export function sticker(
  parent: Node,
  o: {text: string; x?: number; y?: number; color?: string; textColor?: string; icon?: string; size?: number},
) {
  const size = o.size ?? u(40);
  const h = size * 2.15;
  const iconW = o.icon ? size * 1.5 : 0;
  const tw = measure(o.text, size, 800);
  const w = tw + iconW + h * 0.9;
  const n = new Node({x: o.x ?? 0, y: o.y ?? 0, opacity: 0});
  const color = o.color ?? C.accent;
  n.add(new Rect({width: w, height: h, radius: h / 2, fill: color, shadowColor: color, shadowBlur: u(30)}));
  if (o.icon) n.add(new Path({data: o.icon, fill: o.textColor ?? 'white', scale: size / 100, x: -w / 2 + h * 0.45 + size * 0.5}));
  n.add(label(o.text, size, o.textColor ?? 'white', 800, {x: iconW / 2}));
  parent.add(n);
  return n;
}

// ---------------------------------------------------------------- background layers

/**
 * The light background: soft colour blobs that drift slowly. `clock` is a signal that
 * runs from 0 to END seconds (see the sample scene).
 */
export function backdrop(view: Node, clock: SimpleSignal<number>, colors = BLOBS) {
  const bg = new Node({});
  view.add(bg);
  const spots: [number, number, number][] = [
    [-0.35, -0.35, 0.0],
    [0.39, 0.06, 1.7],
    [-0.3, 0.43, 3.1],
  ];
  const size = Math.max(W, H) * 0.51;
  spots.forEach(([fx, fy, ph], i) => {
    bg.add(
      new Circle({
        size,
        fill: colors[i % colors.length],
        opacity: 0.75,
        x: () => fx * W + Math.sin(clock() * 0.35 + ph) * u(90),
        y: () => fy * H + Math.cos(clock() * 0.28 + ph) * u(70),
        filters: [blur(u(150))],
      }),
    );
  });
  return bg;
}

/**
 * A dark layer over the light background, with two slow coloured glows. reveal() opens a
 * growing hole (destination-out) that shows the light layer; cover() brings the dark back.
 */
export function darkLayer(view: Node, clock: SimpleSignal<number>) {
  const node = new Node({cache: true});
  view.add(node);
  node.add(new Rect({size: [W, H], fill: C.dark}));
  const g = Math.max(W, H) * 0.47;
  node.add(new Circle({size: g, fill: C.accent, opacity: 0.2, x: () => -W * 0.28 + Math.sin(clock() * 0.4) * u(80), y: -H * 0.31, filters: [blur(u(180))]}));
  node.add(new Circle({size: g, fill: C.accent2, opacity: 0.22, x: () => W * 0.3 + Math.cos(clock() * 0.33) * u(80), y: H * 0.36, filters: [blur(u(180))]}));
  const hole = new Circle({size: 0, fill: 'white', compositeOperation: 'destination-out'});
  node.add(hole);
  const full = Math.hypot(W, H) * 1.05;
  function* reveal(dur = 1.0, x = 0, y = 0) {
    hole.position([x, y]);
    yield* hole.size(full, dur, easeInOutCubic);
  }
  function* cover(dur = 0.6) {
    hole.size(0);
    node.opacity(0);
    yield* node.opacity(1, dur, easeInOutCubic);
  }
  return {node, hole, reveal, cover};
}

// ---------------------------------------------------------------- the phone

/** The screen is drawn in these units. Screens you make are 640 wide. */
export const SCREEN_W = 640;
export const SCREEN_H = 1390;
const BEZEL = 18;
const BODY_W = SCREEN_W + BEZEL * 2;
const BODY_H = SCREEN_H + BEZEL * 2;

/** A blank screen page to draw on, centred on (0, 0). `height` is in screen units. */
export function screenPage(height = SCREEN_H, fill = 'white') {
  const n = new Node({});
  n.add(new Rect({width: SCREEN_W, height, fill}));
  return n;
}

export type ShowOpts = {
  /** Height of the page in screen units (images: the drawn height at 640 wide). */
  height?: number;
  /** Height of the real content. A tall export often ends in a white tail; scroll stops here. */
  contentHeight?: number;
};

/**
 * A phone that fits a zone. It starts below the frame; enter() brings it up.
 * show() puts a screen in it ('slide' from the right, 'up' from below, or 'cut').
 * scroll() moves a tall screen, but never past its real content.
 */
export function phone(parent: Node, o: {zone?: Zone; x?: number; y?: number} = {}) {
  const z = o.zone ?? Z.stage;
  const s = Math.min((z.h * 0.96) / BODY_H, (z.w * 0.96) / BODY_W);
  const home: [number, number] = [o.x ?? z.x, o.y ?? z.y];
  const node = new Node({x: home[0], y: home[1] + H, rotation: 6});
  parent.add(node);
  const body = new Node({scale: s});
  node.add(body);
  body.add(
    new Rect({
      width: BODY_W, height: BODY_H, radius: 100, fill: C.ink,
      shadowColor: 'rgba(26,23,20,0.30)', shadowBlur: 90, shadowOffsetY: 40,
    }),
  );
  const screen = new Rect({width: SCREEN_W, height: SCREEN_H, radius: 84, clip: true, fill: 'white'});
  body.add(screen);

  let current: Node | null = null;
  let curH = SCREEN_H;
  let curContent = SCREEN_H;

  function* show(content: string | Node, mode: 'slide' | 'up' | 'cut' = 'slide', so: ShowOpts = {}) {
    const h = so.height ?? SCREEN_H;
    const top = (h - SCREEN_H) / 2; // the y that puts the top of the page at the top of the screen
    const page = typeof content === 'string' ? new Img({src: content, width: SCREEN_W, height: h}) : content;
    page.position([0, top]);
    screen.add(page);
    const old = current;
    current = page;
    curH = h;
    curContent = Math.min(so.contentHeight ?? h, h);
    if (mode === 'cut') {
      old?.remove();
      return;
    }
    if (mode === 'slide') page.x(SCREEN_W);
    else page.y(top + SCREEN_H);
    yield* all(
      mode === 'slide' ? page.x(0, 0.6, easeInOutCubic) : page.y(top, 0.7, easeOutCubic),
      old ? old.x(mode === 'slide' ? -SCREEN_W * 0.35 : 0, 0.6, easeInOutCubic) : waitFor(0),
      old ? old.opacity(0.2, 0.6) : waitFor(0),
    );
    old?.remove();
  }

  /** Scroll the current screen to the end of its real content. No-op when it fits. */
  function* scroll(dur: number) {
    if (!current || curContent <= SCREEN_H + 4) return;
    const top = (curH - SCREEN_H) / 2;
    yield* current.y(top - (curContent - SCREEN_H), dur, easeInOutCubic);
  }

  function* enter(dur = 0.9) {
    yield* all(node.y(home[1], dur, softBack), node.rotation(0, dur, easeOutCubic));
  }
  function* exit(dur = 0.7) {
    yield* all(node.y(home[1] + H, dur, easeInCubic), node.rotation(-6, dur));
  }

  /**
   * A point on the phone's outer edge in the parent's coordinates. `t` runs 0 to 1 along
   * the side (top to bottom, or left to right). Use it for a sticker that crosses the edge.
   */
  function edge(side: 'left' | 'right' | 'top' | 'bottom', t = 0.5): [number, number] {
    const [x, y] = [home[0], home[1]];
    const hw = (BODY_W / 2) * s;
    const hh = (BODY_H / 2) * s;
    if (side === 'left') return [x - hw, y - hh + t * 2 * hh];
    if (side === 'right') return [x + hw, y - hh + t * 2 * hh];
    if (side === 'top') return [x - hw + t * 2 * hw, y - hh];
    return [x - hw + t * 2 * hw, y + hh];
  }

  /** A point on the screen, in screen units, turned into the parent's coordinates. */
  function point(sx: number, sy: number): [number, number] {
    return [home[0] + sx * s, home[1] + sy * s];
  }

  return {node, body, screen, scale: s, width: BODY_W * s, height: BODY_H * s, show, scroll, enter, exit, edge, point};
}

// ---------------------------------------------------------------- photo cards

/**
 * A card that slides in tilted, zooms slowly, and carries a chip on its bottom edge.
 * Give `src` for a photo, or `fill` (and optionally `content`) for a card with no photo.
 */
export function photoCard(
  parent: Node,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    rot?: number;
    from?: 'left' | 'right';
    src?: string;
    fill?: string;
    content?: Node;
    color?: string;
    chip?: string;
    icon?: string;
  },
) {
  const rot = o.rot ?? 0;
  const color = o.color ?? C.accent;
  const f = o.w / 410; // the source design was 410 wide
  const away = (o.from ?? (o.x < 0 ? 'left' : 'right')) === 'left' ? -(W / 2 + o.w) : W / 2 + o.w;
  const holder = new Node({x: away, y: o.y, rotation: rot * 4});
  holder.add(
    new Rect({
      width: o.w + 18 * f, height: o.h + 18 * f, radius: 46 * f, fill: 'white',
      shadowColor: 'rgba(26,23,20,0.22)', shadowBlur: 60 * f, shadowOffsetY: 24 * f,
    }),
  );
  const clip = new Rect({width: o.w, height: o.h, radius: 38 * f, clip: true});
  const inner = new Node({});
  if (o.src) inner.add(new Img({src: o.src, width: o.w, height: o.h}));
  else inner.add(new Rect({width: o.w, height: o.h, fill: o.fill ?? C.accentSoft}));
  if (o.content) inner.add(o.content);
  clip.add(inner);
  holder.add(clip);
  let chip: Node | null = null;
  let icon: Path | null = null;
  if (o.chip) {
    chip = new Node({y: o.h / 2 + 4 * f, opacity: 0});
    const cs = 40 * f;
    const iw = o.icon ? cs * 1.3 : 0;
    const cw = measure(o.chip, cs, 800) + iw + 86 * f;
    chip.add(new Rect({width: cw, height: 86 * f, radius: 43 * f, fill: color, shadowColor: color, shadowBlur: 30 * f}));
    if (o.icon) {
      icon = new Path({data: o.icon, fill: 'white', scale: 0.48 * f, x: -cw / 2 + 43 * f + iw / 2 - 6 * f});
      chip.add(icon);
    }
    chip.add(label(o.chip, cs, 'white', 800, {x: iw / 2}));
    holder.add(chip);
  }
  parent.add(holder);

  function* slideIn(dur = 0.75) {
    spawn(inner.scale(1.1, 4, linear));
    yield* all(holder.x(o.x, dur, softBack), holder.rotation(rot, dur, easeOutCubic));
  }
  function* popChip() {
    if (chip) yield* popIn(chip, 0.5);
  }
  function* exit(dur = 0.45) {
    yield* all(holder.x(away, dur, easeInCubic), holder.rotation(away < 0 ? -20 : 20, dur));
    holder.remove();
  }
  return {holder, inner, chip, icon, slideIn, popChip, exit};
}

// ---------------------------------------------------------------- end card

/**
 * The last screen: logo, name, tagline, then two store pills or a URL. It uses the whole
 * safe area and scales itself to fit any shape. Call showLogo() and then showLinks().
 */
export function endCard(
  parent: Node,
  o: {
    logo: Node;
    name: string;
    tagline: string;
    accent?: Record<string, string>;
    above?: string;
    pills?: [string, string][];
    url?: string;
    zone?: Zone;
  },
) {
  const z = o.zone ?? Z.full;
  const design = 240 + 30 + 80 + 40 + 150 + 60 + 34 + 20 + 130; // heights in u() units
  const f = Math.min(1, (z.h * 0.92) / u(design), (z.w * 0.95) / u(860));
  const k = (n: number) => u(n) * f;
  const root = new Node({x: z.x});
  parent.add(root);
  let y = z.y - k(design) / 2;
  const logoY = y + k(120);
  y += k(240 + 30);
  const nameY = y + k(40);
  y += k(80 + 40);
  const tagY = y + k(75);
  y += k(150 + 60);
  const aboveY = y + k(17);
  y += k(34 + 20);
  const pillY = y + k(65);

  const logo = new Node({y: logoY, scale: 0});
  logo.add(o.logo);
  root.add(logo);
  const name = makeText(root, o.name, {y: nameY, size: k(80), weight: 800, color: C.ink});
  const tag = makeText(root, o.tagline, {
    y: tagY, size: k(54), weight: 600, color: C.ink, maxWidth: z.w, accent: o.accent,
  });
  const above = makeText(root, o.above ?? (o.url ? '' : 'Now on'), {y: aboveY, size: k(34), weight: 500, color: C.muted});
  const links: Node[] = [];
  if (o.url) {
    const n = new Node({y: pillY + k(60), opacity: 0});
    const tw = measure(o.url, k(48), 700);
    n.add(new Rect({width: tw + k(120), height: k(120), radius: k(60), fill: C.ink}));
    n.add(label(o.url, k(48), 'white', 700));
    root.add(n);
    links.push(n);
  } else {
    const pills = o.pills ?? [
      ['Download on the', 'App Store'],
      ['Get it on', 'Google Play'],
    ];
    const pw = k(400);
    const gap = k(30);
    pills.forEach(([small, big], i) => {
      const x = (i - (pills.length - 1) / 2) * (pw + gap);
      const n = new Node({x, y: pillY + k(60), opacity: 0});
      n.add(new Rect({width: pw, height: k(130), radius: k(32), fill: C.ink}));
      n.add(label(small, k(24), '#CFC8BE', 500, {y: -k(24)}));
      n.add(label(big, k(44), 'white', 600, {y: k(18)}));
      root.add(n);
      links.push(n);
    });
  }

  function* showLogo() {
    spawn(popIn(logo, 0.8));
    spawn(ring(root, 0, logoY, C.accent, k(220), k(700), k(8)));
    spawn(delay(0.3, reveal(name.words, 0.06)));
    yield* delay(0.6, reveal(tag.words, 0.05));
  }
  function* showLinks() {
    spawn(reveal(above.words));
    yield* sequence(0.15, ...links.map(n => all(n.opacity(1, 0.4), n.y(pillY, 0.6, softBack))));
  }
  return {root, logo, showLogo, showLinks};
}

/** Keep FRAME in the public API for scenes that need the full frame. */
export {FRAME};
