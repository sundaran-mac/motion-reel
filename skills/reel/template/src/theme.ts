// Colours and font for this video. Change them here; lib.ts and the scene read them.
// Take the brand colours from the user's documents or Figma when they exist.

export const C = {
  base: '#FBF9F3', // light background
  ink: '#1A1714', // main text on light
  muted: '#9C938A', // quiet text on light
  accent: '#5B5BD6', // the brand colour
  accentDeep: '#3F3FB0', // a darker accent, for text on light backgrounds
  accentSoft: '#E4E4FA', // a pale accent, for chips and bursts
  accent2: '#2BA387', // a second colour, for "good", "safe", "done"
  accent2Soft: '#DDF2EC',
  card: '#FFFFFF',
  hair: '#E6E0D4', // thin lines and placeholder bars
  sand: '#F2EEE4', // quiet fills
  alert: '#D64545',
  dark: '#0E0D0C', // the dark layer
  darkText: '#F5F2EC', // text on the dark layer
  darkCard: '#2A2622', // fills on the dark layer
  line: '#D9D2C6', // light strokes on the dark layer
};

/** The soft colours that drift behind everything on the light background. */
export const BLOBS = ['#E4E4FA', '#FFE1B5', '#DDF2EC'];

/** The font family. tools/new.mjs downloads Figtree; fonts.css loads it. */
export const FONT = 'Figtree';
