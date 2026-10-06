# Style: motion that looks professional

These rules come from the Humini LIVE reel (2026-10-05) and the fixes the team asked for.
The template's building blocks are described in `template/API.md`. This file says how to
use them well.

## 1. Eases

| Use | Ease |
|---|---|
| Things coming in | ease out (cubic or quint). Fast start, soft stop. |
| Things going out | ease in (cubic). Soft start, fast exit. |
| Things moving from A to B on screen | ease in-out (cubic). |
| A pop (badge, sticker, icon) | soft back: out-back with a small overshoot (about 1.15). Not a big bounce. |
| A slow drift in the background | linear or a slow sine. |

Never use linear for an object that starts or stops in view. It looks like a robot.

## 2. Durations

| Motion | Duration |
|---|---|
| Word rise (each word) | 0.5 to 0.7 s |
| Stagger between words | 0.04 to 0.07 s |
| Pop in | 0.45 to 0.6 s |
| Pop out | 0.25 to 0.3 s |
| Text out (conceal) | 0.25 to 0.35 s |
| Screen swap inside a phone | 0.6 to 0.7 s |
| Phone in from below | about 0.9 s, soft back |
| Scroll a tall screen | 1.2 to 1.5 s |
| Full scene change | 0.4 to 0.5 s |

Faster than 0.2 s looks like a glitch. Slower than 1 s for a small item feels lazy.

## 3. Stagger

- Many items of one kind come in one after another, not all at once.
- Words: 0.04 to 0.07 s apart. Cards and faces: 0.1 to 0.25 s apart.
- Items go out together, or with a very short stagger. Exits are quick.

## 4. Word reveal

- Text appears word by word. Each word rises about 30 px, fades in, and scales from
  0.96 to 1.
- Key words get the accent colour. One to three accent words per line. Not more.
- Force line breaks so lines are balanced. No single word alone on the last line.
- Text leaves by fading and rising a little (conceal). It does not just vanish.

## 5. Pop, rings and bursts

- **Pop:** scale from 0 to 1 with soft back. Use for badges, stickers, icons, avatars.
- **Ring:** a thin circle that grows and fades from an item's centre. Use it to point at
  one thing: a tap, a heart, an alert. One ring per moment.
- **Burst:** small dots or lines that fly out and fade. Use for a success moment (a tick,
  a like). Short: under 0.6 s. Not more than 2 or 3 in a whole video.
- Every pop, ring and burst lands on a cue in `cues.ts`, often on a beat.

## 6. Phones and stickers

- **A sticker or card is either fully inside the screen, or clearly crossing the side
  edge of the phone as a sticker.** Never resting on the black frame by accident. Pick one
  style per video and keep it the same everywhere.
- A crossing sticker sits at least one third over the edge, so it looks on purpose.
- **A tall app screen must never scroll into blank space.** Scroll only to the screen's
  real bottom (its real height minus the visible height). Use the real exported height.
- **A list must not end in a half-cut item.** Show the real full item, or stop the scroll
  earlier so the last visible item is complete.
- Screen swaps slide sideways: the new screen slides in, the old one moves a little and
  fades. Use "up" only for a sheet or a modal.
- The phone has a soft shadow. It never touches the edge of the safe area.

## 7. Captions

- **Never two captions on screen at once.** At a step change, the old caption goes out
  first (about 0.25 s), then the new one comes in (start it about 0.2 s later).
- A step caption has two parts: a small label (`01 · SIGN UP`, wide letter spacing) and
  the main line (2 lines at most).
- The caption sits in the same place for every step. Do not move it around.

## 8. Safe areas per shape

Platforms put buttons and text over the edges of the video. Keep all text, logos, phones
and stickers inside the safe area. Background colour and soft shapes may go to the edge.

The safe area for each shape lives in one place only: the template (`SAFE` and the zones
in `${CLAUDE_SKILL_DIR}/template/API.md`). Place things by zone, never by fixed pixels.
The contact sheet draws the safe area as a red box, so you can check it.

## 9. Type

Font: **Figtree** by default (feels like Spotify and WhatsApp). Any Google Font the user
names is fine.

| Role | 9:16 size | Weight |
|---|---|---|
| Big title (hook, brand) | 72 to 110 px | 800 |
| Section title | 54 to 72 px | 700 |
| Caption main line | 48 to 56 px | 700 |
| Step label | 26 to 30 px, letter spacing 4 | 600 |
| Small text on cards | 28 to 34 px | 500 to 600 |

For 16:9 use about 0.8 times these sizes. For 4:5 and 1:1 use about 0.9 times.
Never smaller than 26 px in the final video. Load every weight before the first frame.

## 10. Colour

- One main brand colour for accents. One second colour at most. A calm base colour.
- Text is near black on light backgrounds, near white on dark ones. Never pure grey text
  on a colour.
- A dark section (for a reveal or for privacy) is good for contrast. Go in and out of it
  with a soft move (a circle that opens, or a fade), not a hard cut.
- The background may drift slowly (soft blurred shapes). Slow: one cycle in 15 to 20 s.

## 11. People

- Real photos of people look more professional than cartoon avatars. Use them.
- Crop faces in circles or rounded cards. Faces look into the frame, not out of it.
- **Never put a name or a quote next to a stock face.** They are models. A made-up name
  next to a real face is a fake review.
- Prefer people who match the audience in the brief.

## 12. Pacing per section

| Section | Pace |
|---|---|
| Hook | Fast. Something moves in the first 0.3 s. The first line ends by 3 to 4 s. |
| Why | Medium. The problem, shown, not just said. |
| Brand reveal | A clear stop and a big moment. The music beat starts here. |
| Features | On the beat. One feature per 3 to 5 s. One screen, one caption, one motion each. |
| Trust | Slower. Calm sounds. Show the promise (lock, shield, eye). |
| End card | Hold still for at least 2 s at the end. Logo, end card text, store badges. |

## 13. Default 60 s structure

| Time | Section | What happens |
|---|---|---|
| 0:00 to 0:06 | Hook | One strong line about the user's world. Faces or a scene. |
| 0:06 to 0:14 | Why | The problem today. Shown with a quick, clear picture. |
| 0:14 to 0:20 | Brand reveal | Product name, one-line promise. Music drop lands here. |
| 0:20 to 0:44 | Features | 5 or 6 features, each on a phone screen with a caption. |
| 0:44 to 0:55 | Trust | Privacy, safety or proof. Calmer. |
| 0:55 to 1:00 | End card | Logo, end card text, store badges. Last frame is finished and still. |

For 30 s: hook 0 to 4, reveal 4 to 8, 3 features 8 to 24, end card 24 to 30.
For 15 s: hook plus reveal 0 to 5, one feature 5 to 11, end card 11 to 15.
For 90 s: same as 60 s, with 8 to 10 features and a short story in the "why".
