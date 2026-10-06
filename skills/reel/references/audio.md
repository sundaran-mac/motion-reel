# Audio: music, sound effects, voice and the mix

Claude cannot hear audio. Every audio choice here is checked by numbers, and then by a
person who listens. Always say that to the user.

## 1. The library

All music and sound effects come from Mixkit (mixkit.co). The catalog and the files live
in `<REEL_HOME>/.library/` (default `~/Reels/.library/`). The repository holds no audio.

| Command | What it does |
|---|---|
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs pick music --mood <a,b> [--genre <g>] [--min <s>] [--n 3] --json` | Best music tracks for these moods, as JSON. |
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs pick sfx --tag <a,b> [--max <s>] [--n 5] --json` | Best sound effects for these tags, as JSON. |
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs info <id>` | Title, artist, length, tags, page link, licence. |
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs path <id>` | The local file path. Downloads it first if missing. |
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs fetch <id> [<id> ...]` | Downloads files into the library. Reuses files already there. |
| `node ${CLAUDE_SKILL_DIR}/tools/library.mjs catalog` | Rebuilds the catalog. Slow (about 5 minutes). Setup already did it. |

Ids look like `music-158` and `sfx-2605`.

Licence: free for company videos on YouTube and social media, no credit needed. Not for
TV or radio broadcast. Do not re-sell or re-share the files. Still list every file in
`CREDITS.md` as a record.

## 2. Mood mapping

Map the user's words to Mixkit moods (and a genre when it helps). Use 2 or 3 moods.

| User says | `--mood` | Good `--genre` |
|---|---|---|
| Upbeat, happy, fun, energetic | `happy,positive,energetic,uplifting` | `pop,corporate-music` |
| Calm, gentle, soft, relaxing | `calm,relaxed,peaceful,soothing` | `ambient,chillout` |
| Emotional, warm, moving, family | `emotional,hopeful,warm,sentimental` | `film-score,folk-pop` |
| Cinematic, epic, big, dramatic | `powerful,dramatic,triumphant` | `film-score,trailer` |
| Tech, modern, startup, digital | `futuristic,driving,confident` | `electronica,synthpop` |
| Corporate, professional, business | `positive,confident,motivating` | `corporate-music` |
| Playful, kids, cute | `playful,cheerful,lighthearted` | `children` |

Length: use `--min <video length + 10>` so the track does not run out. If the best track
is short, it can still work with a music join (section 5).

Show the top 3 to the user: title, artist, length, moods, and the page link to listen.
The user picks. Do not pick for them unless they say "you pick".

## 3. Beat alignment

1. Get the file: `node ${CLAUDE_SKILL_DIR}/tools/library.mjs path <music-id>`.
2. Analyse it: `<python> ${CLAUDE_SKILL_DIR}/tools/beats.py <file> --json`.
   It gives the tempo, the beat times, the drop, and the loud and quiet parts.
3. In `src/cues.ts`, build a beat grid: `beat(k) = B0 + k * BEAT`. `BEAT` is 60 / tempo.
   Put every section start on `beat(k)`. Put pops and swaps on beats or half beats.
4. **The beat starts at the brand reveal, not after it.** Pick the reveal time. Start the
   music at its drop, placed exactly at the reveal: segment `{from: <drop>, at: <reveal>}`.
   Before the reveal there is no music, only voice and sound effects. The LIVE reel
   first started the music after the reveal, and the team asked to move it.
5. Then set `B0` so the beat grid lines up with the music after the reveal:
   `B0 = reveal - k * BEAT` for a whole number `k`.

## 4. Levels that worked

Measured on the Humini LIVE reel, after the team said the first mix was too quiet.

| Part | Setting |
|---|---|
| Voice (Kokoro output) | gain **2.3** |
| Music | gain **0.55**. Before the fix it was 0.3, and the team said "extremely low". |
| Ducking (music under voice) | sidechain compress: threshold **0.02**, ratio **4**, attack **20** ms, release **450** ms |
| Sound effects | gain **0.2 to 0.8**. Small ticks and digits 0.18 to 0.3. Whooshes and pops 0.3 to 0.5. Key moments (lock, heartbeat, impact) 0.55 to 0.8. |
| Final limiter | limit **0.94** |
| Music fade in at a join | 0.04 s |
| Music fade out at a join | 0.3 s |
| Music fade out at the end | about 2.4 s, under the end card |

Rule: **music clearly audible, voice clearly on top.** Start from these numbers. Change
them only after a person listens.

A long sound can be cut with a max length and a 0.2 s fade, so it does not run over the
next moment (for example a ripple or a timer).

## 5. Music joins

Many tracks have a long quiet part (a break) in the middle. A reel cannot wait for it.

1. From beats.py, find the quiet part after the drop, and the next loud part.
2. Split the music into segments in `audio.json`:
   `{"from": <track time>, "at": <video time>, "until": <video time>}`.
3. Jump: the first segment ends a little after the next one starts. The short fades
   make a crossfade.
4. **Hide the join under a whoosh** (or a scene change). Put the join on a beat.
5. Start the second segment on a strong beat of the track, so the beat grid stays.

Example from the LIVE reel: the drop at 14.69 s of the track plays from the reveal. At the
calls step the music jumps to a strong beat at 71.99 s of the track, under a whoosh.

```json
{"music": {"id": "music-158", "segments": [
  {"from": 14.692, "at": 7.06, "until": 34.92},
  {"from": 71.99, "at": 34.67, "until": 60.3}
]},
 "sfx": {"whoosh": "sfx-2605", "lock": "sfx-2854"}}
```

## 6. Sound effects: one distinct sound per kind of motion

**Each different kind of motion gets its own sound.** The same kind of motion may reuse
its sound (every screen swap uses the same soft whoosh). Two different kinds never share
one. The LIVE team noticed when one sound was used for different motions.

| Kind of motion | Suggested `--tag` | Example alias |
|---|---|---|
| Big scene change, phone flies in | `whoosh,woosh,swoosh` | `whoosh` |
| Small screen swap inside the phone | `sweep,swish,transition` | `swap` |
| Pop of a badge, sticker, avatar | `pop,bubbles,notification` | `pop` |
| Tap, toggle, button | `click,interface` | `click` |
| Typing digits or text | `typewriter,type,keyboard,bleep` | `digit` |
| Success, tick, done | `win,ding,alerts` | `check` |
| Lock, privacy, secure | `lock,key` | `lock` |
| Heart, care, love | `heartbeat` | `heartbeat` |
| Magic, joy, sparkle, glow | `sparkle,magic,fairy` | `sparkle` |
| Message, notification badge | `notification,alerts` | `badge` |
| Ring draw, zoom, radar ping | `zoom,high-tech,technology` | `ring-draw` |
| Phone call ringing | `phone-ring,phone` | `ring` |
| Cards slide, paper | `paper,slide` | `card-slide` |
| Things fall, pile up | `falling,paper,thud` | `cards-fall` |
| Timer, time running | `clock,countdown` | `timer` |
| Delete, dissolve | `glitch,sweep,static` | `delete` |
| Camera, eye close | `camera` | `shutter` |
| Build-up before a reveal | `swell,cinematic,intro` | `riser` |
| Logo hit, end card | `impact,boom,hit` | `impact` |

Pick short sounds: `--max 2` for most, `--max 4` for a riser. Listen links from
`library.mjs info <id>` go in the plan, so the user can check.

## 7. Voice

- Kokoro, offline. Voices: `af_heart` (warm female, US), `am_michael` (calm male, US),
  `bf_emma` (female, British). English only.
- One WAV file per line. Each section's length comes from its line's length.
- The voice starts 0.15 to 0.45 s after a section start, so the motion leads.
- Never let two voice lines overlap. Leave at least 0.3 s between lines.
- Numbers and names: write them the way they are said ("sixty-second", not "60-second").

## 8. Loudness reporting

After `node tools/mix.ts`, measure. Get ffmpeg inside the video folder:

```sh
node -e "console.log(require('@ffmpeg-installer/ffmpeg').path)"
```

`npm run mix` prints two loudness numbers at the end (mean and max, in dB):
the longest voice line, and a music-only part. Compare them with what worked before:

| Part | Worked well (measured) | Look for |
|---|---|---|
| Voice line | mean about -17 dB, max about -3 dB | the voice is the loudest normal part |
| Music only | mean about -19 to -20 dB, max about -6 dB | 2 to 3 dB under the voice: clearly there, not hidden |
| Peaks | the limiter keeps them under -0.5 dB | no clipping |
| The start | before the reveal | voice and sound effects only, no music |

If music-only comes out more than about 3 dB under the voice, raise `music.gain` in
`audio.json` (default 0.55) and run `npm run mix` again. Tracks differ: one test track
needed 0.8 to reach 2 dB under the voice. Lower it if the music covers the voice.

For a finer check, integrated loudness (LUFS) of the whole mix:
`<ffmpeg> -hide_banner -i out/mix.wav -af ebur128 -f null -` (read `I:`). About -14 to
-16 LUFS suits social video; this is a guide, not a measured value from our reels.

These targets are a guide, not a rule. Report the numbers to the user in a small table,
and always add: **"I cannot hear audio. Please listen once, on a phone speaker and on
headphones, before you share it."**
