// Shape-aware layout. A scene places things by zone, never by fixed pixels, so one
// scene works in 9:16, 16:9, 4:5 and 1:1. The numbers live in shapes.json, which
// tools/new.mjs and tools/sheet.mjs read too, so there is one copy of them.
//
// Coordinates are Motion Canvas coordinates: (0, 0) is the centre of the frame,
// x grows to the right and y grows down.
import shapes from './shapes.json';
import {SHAPE} from './shape.ts';

type ShapeRow = {
  w: number;
  h: number;
  safe: [number, number, number, number]; // top, right, bottom, left
  k: number;
  side: boolean;
  stageWidth?: number;
  rows: number[];
};

const S = (shapes as unknown as Record<string, ShapeRow>)[SHAPE];
if (!S) throw new Error(`Unknown shape ${SHAPE}. Use 9:16, 16:9, 4:5 or 1:1.`);

export {SHAPE};
export const W = S.w;
export const H = S.h;

/** 'portrait' (9:16, 4:5), 'landscape' (16:9) or 'square' (1:1). */
export const ORIENT: 'portrait' | 'landscape' | 'square' =
  W > H ? 'landscape' : W === H ? 'square' : 'portrait';

/** True when the stage sits left and the text column sits right (16:9 and 1:1). */
export const SIDE = S.side;

/** Scale a size from the 1080 x 1920 design to this shape. Use it for every size. */
export const u = (n: number) => Math.round(n * S.k * 100) / 100;

export type Zone = {
  x: number; // centre
  y: number; // centre
  w: number;
  h: number;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

export function zone(left: number, top: number, right: number, bottom: number): Zone {
  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    w: right - left,
    h: bottom - top,
    top,
    bottom,
    left,
    right,
  };
}

/** The smallest zone that holds all the given zones. */
export function union(...zs: Zone[]): Zone {
  return zone(
    Math.min(...zs.map(z => z.left)),
    Math.min(...zs.map(z => z.top)),
    Math.max(...zs.map(z => z.right)),
    Math.max(...zs.map(z => z.bottom)),
  );
}

/** A zone made smaller by `by` on every side. */
export function inset(z: Zone, by: number): Zone {
  return zone(z.left + by, z.top + by, z.right - by, z.bottom - by);
}

const [sT, sR, sB, sL] = S.safe;

/** The whole frame. Backgrounds and full-bleed layers use it. */
export const FRAME = zone(-W / 2, -H / 2, W / 2, H / 2);

/** The safe area: no text, sticker or button goes outside it. Platform buttons cover the rest. */
export const SAFE = zone(-W / 2 + sL, -H / 2 + sT, W / 2 - sR, H / 2 - sB);

const GAP = u(30);

function rows(z: Zone, fr: number[]): Zone[] {
  const total = fr.reduce((a, b) => a + b, 0);
  let y = z.top;
  return fr.map(f => {
    const h = (z.h * f) / total;
    const r = zone(z.left, y, z.right, y + h);
    y += h;
    return r;
  });
}

function build() {
  if (!S.side) {
    const [title, stage, caption, footer] = rows(SAFE, S.rows);
    return {title, stage, caption, footer};
  }
  const sw = SAFE.w * (S.stageWidth ?? 0.45);
  const stage = zone(SAFE.left, SAFE.top, SAFE.left + sw, SAFE.bottom);
  const col = zone(SAFE.left + sw + GAP, SAFE.top, SAFE.right, SAFE.bottom);
  const [title, caption, footer] = rows(col, S.rows);
  return {title, stage, caption, footer};
}

/**
 * Named zones.
 * - full: the whole safe area, for a moment with no device (a hook line, a logo).
 * - title: the headline band. Top in portrait; top of the right column in 16:9 and 1:1.
 * - stage: the main visual (a phone, cards, an icon). Middle in portrait; left in 16:9 and 1:1.
 * - caption: the supporting text under the title. Below the stage in portrait; middle right
 *   in 16:9 and 1:1.
 * - footer: the bottom band, for pills, a URL or a small note.
 * The four named zones never overlap.
 */
export const Z = {full: SAFE, ...build()};
