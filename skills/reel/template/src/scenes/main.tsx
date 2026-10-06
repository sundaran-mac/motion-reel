// A generic sample reel for "Your App", about 22 seconds. It shows every part of lib.ts
// and works in all four shapes, because everything is placed by zone (layout.ts).
// Replace it with the real script: keep the pattern, change the content.
import {Circle, makeScene2D, Node, Path, Rect} from '@motion-canvas/2d';
import {
  all,
  chain,
  createSignal,
  delay,
  easeInCubic,
  easeOutCubic,
  linear,
  sequence,
  spawn,
} from '@motion-canvas/core';
import {END, S, T} from '../cues.ts';
import {SIDE, Z, u, union} from '../layout.ts';
import {
  at,
  backdrop,
  burst,
  C,
  captions,
  card,
  conceal,
  darkLayer,
  endCard,
  ICONS,
  label,
  loadFonts,
  makeText,
  phone,
  photoCard,
  popIn,
  popOut,
  reveal,
  ring,
  screenPage,
  SCREEN_H,
  SCREEN_W,
  softBack,
  sticker,
} from '../lib.ts';

/** The app logo: a rounded square with a sparkle. Swap in the real logo (an Img). */
function logoMark(size: number) {
  const n = new Node({});
  n.add(new Rect({width: size, height: size, radius: size * 0.28, fill: C.accent, shadowColor: 'rgba(91,91,214,0.35)', shadowBlur: size * 0.25}));
  n.add(new Path({data: ICONS.sparkle, fill: 'white', scale: size / 160}));
  n.add(new Circle({x: size * 0.24, y: -size * 0.24, size: size * 0.16, fill: C.accent2}));
  return n;
}

/** Placeholder screen 1: a list of plans. Drawn in screen units (640 wide). */
function screenList() {
  const p = screenPage();
  const top = -SCREEN_H / 2;
  p.add(new Rect({y: top + 130, width: SCREEN_W, height: 260, fill: C.accent}));
  p.add(new Rect({x: -150, y: top + 150, width: 240, height: 34, radius: 17, fill: 'rgba(255,255,255,0.9)'}));
  p.add(new Rect({x: -180, y: top + 205, width: 180, height: 22, radius: 11, fill: 'rgba(255,255,255,0.55)'}));
  const dots = [C.accent, C.accent2, '#F2A93B', C.accent, C.accent2];
  dots.forEach((d, i) => {
    const y = top + 340 + i * 170;
    const row = card({y, w: 580, h: 140, r: 28});
    row.add(new Circle({x: -220, size: 76, fill: d}));
    row.add(new Rect({x: -40, y: -20, width: 240, height: 22, radius: 11, fill: C.ink, opacity: 0.8}));
    row.add(new Rect({x: -70, y: 20, width: 180, height: 18, radius: 9, fill: C.hair}));
    row.add(new Rect({x: 210, width: 70, height: 36, radius: 18, fill: C.sand}));
    p.add(row);
  });
  p.add(new Rect({y: SCREEN_H / 2 - 120, width: 520, height: 100, radius: 50, fill: C.ink}));
  p.add(label('New plan', 36, 'white', 700, {y: SCREEN_H / 2 - 120}));
  return p;
}

/** Placeholder screen 2: a tall chat. The page is 2400 tall, the real content 2000. */
const TALL_H = 2400;
const TALL_CONTENT = 2000;
function screenChat() {
  const p = screenPage(TALL_H);
  const top = -TALL_H / 2;
  p.add(new Rect({y: top + 90, width: SCREEN_W, height: 180, fill: C.sand}));
  p.add(new Circle({x: -230, y: top + 110, size: 70, fill: C.accent2}));
  p.add(new Rect({x: -80, y: top + 110, width: 200, height: 26, radius: 13, fill: C.ink, opacity: 0.8}));
  const plan = card({y: top + 330, w: 560, h: 220, r: 32, fill: C.accentSoft});
  plan.add(new Rect({x: -150, y: -50, width: 200, height: 28, radius: 14, fill: C.accentDeep}));
  plan.add(new Rect({x: -110, y: 0, width: 280, height: 20, radius: 10, fill: C.card}));
  plan.add(new Rect({y: 60, width: 480, height: 56, radius: 28, fill: C.accent}));
  p.add(plan);
  for (let i = 0; i < 9; i++) {
    const mine = i % 3 === 1;
    const w = 260 + ((i * 70) % 160);
    const y = top + 540 + i * 160;
    p.add(new Rect({x: mine ? 300 - w / 2 - 20 : -300 + w / 2 + 20, y, width: w, height: 110, radius: 32, fill: mine ? C.accent : C.sand}));
  }
  // The end of the real content: a bar the scroll must stop at, not past.
  p.add(new Rect({y: top + TALL_CONTENT - 60, width: SCREEN_W, height: 120, fill: C.accent2}));
  p.add(label('end of content', 30, 'white', 700, {y: top + TALL_CONTENT - 60}));
  return p;
}

/** A small chat bubble with three dots, for the hook. */
function bubble(x: number, y: number) {
  const n = new Node({x, y, opacity: 0});
  n.add(new Rect({width: u(200), height: u(100), radius: u(50), fill: C.darkCard, stroke: '#3A3530', lineWidth: 2}));
  [-1, 0, 1].forEach(i => n.add(new Circle({x: i * u(40), size: u(22), fill: C.line})));
  return n;
}

export default makeScene2D(function* (view) {
  yield* loadFonts();
  view.fill(C.base);

  const clock = createSignal(0);
  spawn(clock(END, END, linear));
  backdrop(view, clock);
  const dark = darkLayer(view, clock);
  const stage = new Node({});
  view.add(stage);

  // ===================== hook, on the dark layer =====================
  yield* at(T.hookText);
  const hook = makeText(stage, 'Plans fall apart\nin the group chat.', {
    zone: Z.full, size: u(84), weight: 800, color: C.darkText, accent: {apart: C.accentSoft},
  });
  const F = Z.full;
  const bubbles = [
    bubble(F.left + F.w * 0.28, F.top + F.h * 0.16),
    bubble(F.right - F.w * 0.25, F.top + F.h * 0.26),
    bubble(F.left + F.w * 0.32, F.bottom - F.h * 0.18),
  ];
  bubbles.forEach(b => stage.add(b));
  yield* all(
    reveal(hook.words, 0.07, 0.7),
    delay(0.5, sequence(0.3, ...bubbles.map(b => popIn(b, 0.5)))),
    ...bubbles.map((b, i) => b.y(b.y() + (i % 2 ? u(16) : -u(16)), 3, easeOutCubic)),
  );

  // ===================== logo, on the light layer =====================
  yield* at(T.reveal);
  spawn(conceal(hook.root));
  spawn(all(...bubbles.map(b => popOut(b))));
  spawn(dark.reveal(1.0));
  yield* at(T.logoIn);
  const brand = new Node({x: Z.title.x, y: Z.title.y});
  stage.add(brand);
  const L = Math.min(u(150), Z.title.h * 0.7);
  const nameSize = L * 0.52;
  const name = makeText(brand, 'Your App', {size: nameSize, weight: 800, color: C.ink, maxWidth: Z.title.w});
  const last = name.words[name.words.length - 1];
  const nw = last.x + last.w - name.words[0].x;
  const gap = u(28);
  const rowW = L + gap + nw;
  const logo = logoMark(L);
  logo.x(-rowW / 2 + L / 2);
  name.root.x(-rowW / 2 + L + gap + nw / 2);
  brand.add(logo);
  brand.scale(Math.min(1, (Z.title.w * 0.95) / rowW));
  spawn(ring(brand, logo.x(), 0, C.accent, L, L * 3, u(8)));
  spawn(popIn(logo, 0.8));
  spawn(delay(0.3, reveal(name.words, 0.06)));
  const tag = makeText(stage, 'Plans that actually happen.', {zone: Z.caption, size: u(60), weight: 700, color: C.ink, accent: {happen: C.accentDeep}});
  spawn(delay(0.5, reveal(tag.words, 0.06)));

  // ===================== two cards with no photo =====================
  const st = Z.stage;
  const cw = Math.min(st.w * 0.46, st.h * 0.7 * (410 / 560));
  const ch = (cw * 560) / 410;
  const f = cw / 410;
  const contentA = new Node({});
  const cal = new Node({y: -40 * f});
  cal.add(new Rect({width: 220 * f, height: 200 * f, radius: 28 * f, fill: C.card}));
  cal.add(new Rect({y: -70 * f, width: 220 * f, height: 60 * f, radius: [28 * f, 28 * f, 0, 0], fill: C.accent}));
  for (let i = 0; i < 6; i++) cal.add(new Circle({x: (-60 + (i % 3) * 60) * f, y: (10 + Math.floor(i / 3) * 50) * f, size: 26 * f, fill: i === 4 ? C.accent : C.hair}));
  contentA.add(cal);
  const contentB = new Node({});
  [C.accent, '#F2A93B', C.accent2].forEach((c, i) => {
    contentB.add(new Circle({x: (i - 1) * 90 * f, y: -40 * f, size: 130 * f, fill: c, stroke: 'white', lineWidth: 8 * f}));
  });
  const cardA = photoCard(stage, {
    x: st.x - cw * 0.53, y: st.y - 30 * f, w: cw, h: ch, rot: -5, fill: C.accentSoft, content: contentA,
    color: C.accent, chip: 'Plan', icon: ICONS.sparkle,
  });
  const cardB = photoCard(stage, {
    x: st.x + cw * 0.53, y: st.y - 30 * f, w: cw, h: ch, rot: 5, fill: C.accent2Soft, content: contentB,
    color: C.accent2, chip: 'Share', icon: ICONS.heart,
  });
  yield* at(T.cardA - 0.35);
  spawn(cardA.slideIn());
  yield* at(T.cardA + 0.4);
  spawn(cardA.popChip());
  spawn(burst(cardA.holder, 0, ch / 2, [C.accent, C.accentSoft, '#F2A93B'], 16, 220 * f, 20 * f));
  spawn(delay(0.15, cardA.icon!.rotation(360, 1.4, easeOutCubic)));
  yield* at(T.cardB - 0.35);
  spawn(cardB.slideIn());
  yield* at(T.cardB + 0.4);
  spawn(cardB.popChip());
  spawn(ring(cardB.holder, 0, ch / 2, C.accent2, 120 * f, 380 * f, 5 * f));

  // ===================== the phone =====================
  yield* at(T.phoneIn - 0.3);
  spawn(all(brand.opacity(0, 0.4), brand.y(brand.y() - u(200), 0.4, easeInCubic), tag.root.opacity(0, 0.3)));
  spawn(cardA.exit());
  spawn(cardB.exit());
  yield* at(T.phoneIn);
  brand.remove();
  tag.root.remove();

  const phoneZone = SIDE ? Z.stage : union(Z.stage, Z.caption, Z.footer);
  const capZone = SIDE ? union(Z.title, Z.caption) : Z.title;
  const ph = phone(stage, {zone: phoneZone});
  const cap = captions(stage, capZone, {size: SIDE ? u(64) : u(54)});
  const fx = new Node({}); // callouts float above the phone
  stage.add(fx);
  yield* ph.show(screenList(), 'cut');
  spawn(ph.enter());
  spawn(cap.show('01  ·  PLAN', 'Make a plan\nin seconds.'));
  yield* at(T.sticker);
  const [sx, sy] = ph.edge('right', 0.78);
  const tagDone = sticker(fx, {text: 'Done in 10 s', x: sx, y: sy, icon: ICONS.sparkle, color: C.accent2});
  spawn(popIn(tagDone, 0.5));
  spawn(burst(fx, sx, sy, [C.accent2, C.accent2Soft], 12, u(160), u(14)));

  yield* at(T.swap);
  spawn(popOut(tagDone));
  spawn(cap.show('02  ·  SHARE', 'Share it with\nyour people.'));
  spawn(ph.show(screenChat(), 'slide', {height: TALL_H, contentHeight: TALL_CONTENT}));
  yield* at(T.scroll);
  spawn(ph.scroll(1.2));

  // ===================== privacy, on the dark layer =====================
  yield* at(S.privacy);
  spawn(cap.clear(0.3));
  spawn(ph.exit());
  spawn(dark.cover(0.6));
  const head = makeText(stage, 'Private by default.', {
    zone: Z.title, size: u(70), weight: 800, color: C.darkText, accent: {Private: C.accentSoft},
  });
  spawn(reveal(head.words, 0.06));

  // A padlock: drops in, lands, jumps, and the shackle snaps shut.
  const ls = Math.min(Z.stage.h * 0.62 / 520, Z.stage.w * 0.7 / 320, u(1));
  const lockHome = Z.stage.y + 40 * ls;
  const lock = new Node({x: Z.stage.x, y: -1400, scale: ls});
  stage.add(lock);
  const shackle = new Rect({y: -170, width: 190, height: 260, radius: 95, stroke: C.line, lineWidth: 36});
  lock.add(shackle);
  const body = new Rect({y: 40, width: 320, height: 260, radius: 56, fill: C.accent, shadowColor: 'rgba(91,91,214,0.4)', shadowBlur: 60});
  lock.add(body);
  lock.add(new Circle({y: 20, size: 56, fill: C.dark}));
  lock.add(new Rect({y: 66, width: 22, height: 64, radius: 11, fill: C.dark}));
  yield* at(T.lockDrop);
  yield* lock.y(lockHome, T.lockLand - T.lockDrop, easeInCubic);
  yield* chain(body.scale([1.08, 0.9], 0.1, easeOutCubic), body.scale(1, 0.3, softBack));
  yield* at(T.lockJump);
  yield* chain(lock.y(lockHome - 65 * ls, 0.2, easeOutCubic), lock.y(lockHome, 0.24, easeInCubic));
  yield* at(T.lockClose - 0.16);
  yield* shackle.y(-95, 0.16, easeInCubic);
  spawn(chain(...[-5, 4, -2, 0].map(r => lock.rotation(r, 0.07))));
  spawn(body.fill(C.accent2, 0.35));
  spawn(ring(stage, Z.stage.x, lockHome + 40 * ls, C.accent2, 340 * ls, 900 * ls, u(6)));
  spawn(burst(stage, Z.stage.x, lockHome + 40 * ls, [C.accent2, C.accent2Soft, C.accentSoft], 18, 360 * ls, u(16)));
  const sub = makeText(stage, 'Only your group\ncan see a plan.', {zone: Z.caption, size: u(56), weight: 700, color: C.darkText});
  spawn(reveal(sub.words, 0.05));

  // ===================== end card =====================
  yield* at(T.endReveal);
  spawn(conceal(head.root, 0.3));
  spawn(conceal(sub.root, 0.3));
  spawn(popOut(lock));
  fx.removeChildren();
  spawn(dark.reveal(0.9));
  const end = endCard(stage, {
    logo: logoMark(u(220)),
    name: 'Your App',
    tagline: 'Plans that actually happen.',
    accent: {happen: C.accentDeep},
  });
  yield* at(T.endLogo);
  spawn(end.showLogo());
  yield* at(T.links);
  spawn(end.showLinks());
  // The last frame is the finished end card: no fade out.
  yield* at(END);
});
