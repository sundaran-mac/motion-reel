# Spec: the `reel` skill

Status: agreed 2026-10-06. Owner: Sundaran V. Started 2026-10-06.

## 1. Where this comes from

On 2026-10-05 we made a 60 second promo reel for Humini LIVE with Claude Code. It was
built step by step in one long chat: Figma screens, product docs, an offline voice, free
sound effects, a music track, and three rounds of fixes. The team saw it in stand-up on
2026-10-06 and asked for the same result as a reusable skill, on any teammate's machine,
without that long chat.

This skill packs what worked, and every fix we had to make, into one repeatable flow.

## 2. What the skill does

A teammate types `/reel` (or asks Claude for a reel, promo video or motion video). Claude:

1. asks the questions the request did not already answer;
2. reads any documents, links or Figma file the user gives;
3. offers 2 or 3 script options and waits for the user to choose;
4. gathers the assets: screens, photos, music, sound effects, voice;
5. builds the video in Motion Canvas from the bundled template;
6. renders a fast draft and checks it against `references/checklist.md`;
7. renders the final video and mixes the sound;
8. delivers an MP4, and an artifact page with the video if the user wants one;
9. takes corrections by time ("at 0:21, make the calendar bigger") and re-renders.

## 3. Defaults

| Setting | Default | Other choices |
|---|---|---|
| Length | 60 s | 15, 30, 90 s, or any length |
| Shape | 9:16 (1080 x 1920) | 16:9 (1920 x 1080), 4:5 (1080 x 1350), 1:1 (1080 x 1080) |
| Frame rate | 60 fps | 30 fps for a faster render |
| Voice | On, English, offline | Off (text only) |
| Music | Picked by mood from the library | A file the user gives |
| Sound effects | On, one distinct sound per kind of motion | Off |
| Font | Figtree | Any Google Font the user names |

## 4. The questions

Claude asks only what the request and documents do not answer. Each question is short,
uses plain words, and shows a small example under each option.

| # | Question | Options shown |
|---|---|---|
| 1 | Where will the video be posted? | Reel, Shorts or Status (9:16) · YouTube (16:9) · Feed post (4:5) · Square (1:1), each with a small layout sketch |
| 2 | How long? | 15 s · 30 s · 60 s · 90 s |
| 3 | What is it about, and who will watch it? | Free text, or "I will add documents" |
| 4 | Any documents, links or Figma file? | A folder path, a URL, a Figma link, or none |
| 5 | Voice-over? | On (choose one of 3 sample voices) · Off |
| 6 | Music mood? | Upbeat · Calm · Emotional · Cinematic · Tech. Claude then shows the top 3 tracks with links to listen. |
| 7 | End card text? | Example: "Now on the App Store and Google Play" |
| 8 | Brand colours and logo? | Taken from documents or Figma when present, else asked |

If the user gives documents, Claude reads them first and asks only what is still missing.

## 5. Script options

Before building, Claude writes 2 or 3 script options. Each option is a short table: time,
voice line, and what is on screen. The options differ in angle (for example "problem first",
"feature tour", "story of one user"). The user picks one, mixes them, or edits lines.
Nothing is built before the user approves a script.

## 6. The audio library

### 6.1 Source

All music and sound effects come from Mixkit (mixkit.co):

- music: about 1,050 tracks, 79 moods, plus genre and instrument tags;
- sound effects: about 2,900 sounds in 276 categories.

Both are free for company videos on YouTube and social media, with no credit needed.
Not allowed: TV or radio broadcast, re-selling the files, or claiming the tracks as ours.

Pixabay was tested on 2026-10-06 and is not used: its website refuses scripts (HTTP 403),
and its official API covers images and videos only. Using a browser to get around that
was ruled out: the skill must not drive the user's browser.

### 6.2 Where files live

The repository holds code only. No audio file, catalog or model is committed, because the
Mixkit licence does not allow re-sharing the files, and because of size.

Each machine keeps one shared library in its home folder:

```
~/Reels/                     (Windows: C:\Users\<name>\Reels\)
  .library/
    catalog.json             every track and sound with its tags and length
    music/  sfx/             only the files a video has used so far
    kokoro/                  the voice model
  <video-name>/              one folder per video
```

Before each download Claude checks `.library/`. A file already there is reused.

### 6.3 Picking

- **Music:** scored by mood, genre and tag against the user's request, filtered by length.
  The top 3 are shown with links to listen. The chosen track is analysed for its beat,
  its drop and its quiet parts, so the music starts on a beat at the brand reveal and
  skips a long quiet part in the middle.
- **Sound effects:** one distinct sound per kind of motion (a pop, a whoosh, a lock click,
  a heartbeat). The same kind of motion may reuse its sound; two different kinds never
  share one.

## 6.4 Photos

No account or key. Tested on 2026-10-06:

- Claude's own web search finds Unsplash photo pages (`site:unsplash.com/photos ...`).
- A script cannot read Unsplash's search page (bot check), but it can download a free
  photo from its page link (`/photos/<id>/download`).
- A paid Unsplash+ photo refuses the same download (HTTP 403), so a paid photo is never
  used by mistake: it is simply skipped.

So Claude searches, the script tries each link, Claude looks at what downloaded, keeps
the best and crops it. Every photo goes into `CREDITS.md` with its page link.

If web search is not available to the user's Claude, or too few good photos come back,
Claude asks for the user's own photos.

## 7. Voice

Kokoro, an open voice model that runs offline on the machine. The script never leaves
the machine. English only (American and British voices). Each line is a separate file,
and each scene's length comes from its line's length, so voice and picture always match.

## 8. The video template

A Motion Canvas project (TypeScript), bundled in `template/`:

- `src/cues.ts` is the one timeline. Every motion, voice line, sound effect and music
  join reads its time from it, so sound and picture never drift apart.
- `src/lib.ts` holds the parts: word-by-word text, pop, burst, ring, phone frame, photo
  card, sticker, end card.
- Layout reads the chosen shape. Elements are placed inside safe areas, not at fixed
  pixels, so one scene works in all four shapes.
- `tools/render.mjs` renders with no clicks, `tools/mix.ts` mixes and encodes.

## 9. Checks before delivery

`references/checklist.md` lists every fix from the LIVE reel as a rule. Claude renders a
fast draft, makes a contact sheet of frames, and checks it against the list. Examples:

- no sticker sits on a device's frame unless it crosses the edge on purpose;
- no white gap when a tall screen scrolls; no half-cut last card;
- never two captions on screen at once;
- the beat starts at the brand reveal, not after it;
- music clearly audible, voice clearly on top (levels in `references/audio.md`);
- the last frame is a finished end card.

Claude cannot hear audio. It measures loudness and reports that a person must listen.

## 10. Setup on a new machine

One command per machine. `setup.mjs` does the work on both systems; `setup.sh` (Mac)
and `setup.ps1` (Windows) only check that Node is installed and then run it.

| Step | Mac (Apple Silicon) | Windows (x64) |
|---|---|---|
| Node 22 or later | required; prints the install line if missing | same |
| Python 3.10 or later | `python3`; prints the Homebrew line if missing | `py` or `python`; prints the winget line if missing |
| Voice model | downloaded into `.library/kokoro/` with its Python packages | same |
| ffmpeg | bundled build for Apple Silicon | bundled build for Windows |
| Render browser | downloaded once | same |
| Catalog | built once, about 5 minutes | same |

Setup can run again safely; finished steps are skipped.

## 11. Output

Inside `~/Reels/<video-name>/`:

- `out/<video-name>.mp4`: full quality;
- `out/<video-name>-web.mp4`: under 15 MB, for an artifact page;
- `CREDITS.md`: every track, sound and photo with its source and licence.

## 12. Limits

- Claude cannot hear the audio; a person must listen before the video is shared.
- English voice only.
- Intel Macs and Windows on ARM are not supported in the first version.
- People in stock photos are models, so the video never puts a name or a quote next to
  a face.
- Mixkit can change its pages. The catalog is built once and kept, so an old catalog keeps
  working if a rebuild fails.

## 13. Not in this version

- Live search of Pixabay or any site through the browser.
- Voices in Hindi, Tamil or other languages.
- Burnt-in subtitles (a later version can add them from the voice script).

## 14. Decisions

| Date | Decision | By |
|---|---|---|
| 2026-10-06 | The skill is named `reel`; the repository is `sundaran-mac/motion-reel`, public | Sundaran |
| 2026-10-06 | Work folder is `~/Reels` | Sundaran |
| 2026-10-06 | No browser automation inside the skill | Sundaran |
| 2026-10-06 | Mixkit is the only music and sound effects source; Pixabay dropped after the test in 6.1 | Sundaran |
| 2026-10-06 | Photos through Claude's web search and free Unsplash downloads, no API keys (6.4) | Sundaran |
| 2026-10-06 | Supported systems: Apple Silicon Macs and Windows x64 | Sundaran |
| 2026-10-06 | Setup is one Node script for both systems, with thin `.sh` and `.ps1` starters | Sundaran |
