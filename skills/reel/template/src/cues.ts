// The one timeline. The scene waits on these times (yield* at(T.logoIn)), and
// tools/mix.ts places every voice line, sound effect and music part at the same
// times. Change a time here and the motion and the sound move together.
//
// Import with the .ts extension: tools/mix.ts runs this file in Node too.
import {FPS, LENGTH} from './shape.ts';
import {VO_DUR} from './vo.ts';

export {FPS, LENGTH};

// The music beat. Put section starts on beats so cuts land on the music.
// tools/beats.py in the skill prints BPM and the first beat of a track.
export const BEAT = 0.5; // seconds per beat (120 bpm)
export const B0 = 0; // time of the first beat
export const beat = (k: number) => +(B0 + k * BEAT).toFixed(3);

/** Length of a voice line, or a fallback before tools/vo.py has run. */
export const vo = (key: string, fallback = 2.5) => VO_DUR[key] ?? fallback;

// Section starts.
export const S = {
  hook: 0,
  logo: beat(7),
  cards: beat(13),
  phone: beat(20),
  phone2: beat(25),
  privacy: beat(30),
  end: beat(37),
} as const;

export const END = beat(44); // 22 s

// Every named moment.
export const T = {
  hookText: 0.3,
  reveal: S.logo,
  logoIn: S.logo + 0.1,
  cardA: S.cards + 0.1,
  cardB: S.cards + 0.8,
  phoneIn: S.phone,
  sticker: S.phone + 1.5,
  swap: S.phone2 + 0.2,
  scroll: S.phone2 + 1.0,
  lockDrop: S.privacy + 0.45,
  lockLand: S.privacy + 0.9,
  lockJump: S.privacy + 1.35,
  lockClose: S.privacy + 1.95,
  endReveal: S.end,
  endLogo: S.end + 0.1,
  links: S.end + 1.6,
} as const;

// Music parts: `from` is the time in the track, `at` the time in the video, `until`
// the time in the video where the part ends. Start the music on a beat at the brand
// reveal. Leave MUSIC empty to use "segments" from audio.json instead.
export type MusicPart = {from: number; at: number; until: number};
export const MUSIC: MusicPart[] = [{from: 0, at: S.logo, until: END}];

// Voice lines: key matches vo.json and public/vo/<key>.wav.
export const VO: {key: string; at: number}[] = [
  {key: 'hook', at: T.hookText + 0.15},
  {key: 'end', at: S.end + 0.45},
];

// Sound effects by alias (audio.json maps the alias to a library id). `gain` is the
// level, `max` the longest it may play in seconds.
export type Sfx = {sfx: string; at: number; gain: number; max?: number};
export const SFX: Sfx[] = [
  {sfx: 'whoosh', at: T.reveal, gain: 0.5},
  {sfx: 'pop', at: T.logoIn, gain: 0.45},
  {sfx: 'whoosh', at: T.cardA - 0.3, gain: 0.35},
  {sfx: 'whoosh', at: T.cardB - 0.3, gain: 0.35},
  {sfx: 'whoosh', at: T.phoneIn, gain: 0.5},
  {sfx: 'pop', at: T.sticker, gain: 0.4},
  {sfx: 'whoosh', at: T.swap, gain: 0.25},
  {sfx: 'pop', at: T.lockLand, gain: 0.4},
  {sfx: 'lock', at: T.lockClose, gain: 0.8, max: 1.5},
  {sfx: 'whoosh', at: T.endReveal, gain: 0.5},
  {sfx: 'pop', at: T.endLogo, gain: 0.5},
  {sfx: 'pop', at: T.links, gain: 0.35},
];
