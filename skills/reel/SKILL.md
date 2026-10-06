---
name: reel
description: Makes a short motion graphics video (a reel, promo video, explainer video or app launch video) with voice-over, music and sound effects, rendered to MP4 on this machine. Use when the user says "make a reel", "promo video", "motion graphics video", "explainer video for my app", "launch video", "video for Instagram / YouTube Shorts / WhatsApp Status", or types "/reel:reel" (the plugin command) or "/reel".
argument-hint: "[what the video is about] [docs folder, link or Figma URL]"
---

# reel: a motion video from a request

You make a finished video: an MP4 with motion, voice, music and sound effects.
You work in phases. Do not skip a phase. Wait where a phase says wait.

Write to the user in short, plain English. One idea per sentence. Common words.

## Hard rules

- **Never commit or push video work.** Videos are not code. They live in `~/Reels`.
- **Every video lives in its own folder:** `<REEL_HOME>/<video-name>/`.
  `REEL_HOME` is the env var, default `~/Reels` (Windows: `C:\Users\<name>\Reels`).
- **The shared library is `<REEL_HOME>/.library/`.** Reuse what is there. Never delete it.
- **Bundled files are under `${CLAUDE_SKILL_DIR}`.** Always use that variable in commands.
  It works on Mac and Windows.
- **You cannot hear audio.** You measure loudness. You always tell the user to listen.
- **Nothing is built before the user picks a script and approves the plan.**
- **The template's code API is in `${CLAUDE_SKILL_DIR}/template/API.md`.** Read it before
  you write a scene. It is the only description of that API. Do not guess it.
- **Fonts:** Figtree by default, titles at weight 700 to 800.
- **People photos:** real photos look more professional than cartoon avatars. Never put a
  name or a quote next to a stock face. Those people are models.

## The reference files

Read each one when its phase says so. Do not load them all at the start.

| File | When |
|---|---|
| `${CLAUDE_SKILL_DIR}/references/questions.md` | Phase 1, before you ask anything |
| `${CLAUDE_SKILL_DIR}/references/style.md` | Phase 2 and 3, before scripts and the plan |
| `${CLAUDE_SKILL_DIR}/references/audio.md` | Phase 3 and 4, music, sound effects, voice, mix |
| `${CLAUDE_SKILL_DIR}/references/checklist.md` | Phase 3 (self-review), Phase 5 and 6 |
| `${CLAUDE_SKILL_DIR}/template/API.md` | Phase 4, before you write cues and scenes |

## Phase 0: check setup

Find the config file: `<REEL_HOME>/.library/config.json`.

```sh
node ${CLAUDE_SKILL_DIR}/setup.mjs --check
```

- If every step is `ok`, go on. Get the Python path for later with
  `node ${CLAUDE_SKILL_DIR}/tools/config.mjs get python`.
- If a step is missing, tell the user in one short message: "This machine is not set up
  for reels yet. Setup downloads about 700 MB once (voice model, render browser, music
  catalog) and takes about 10 minutes. Shall I run it now?"
  - On yes: run `node ${CLAUDE_SKILL_DIR}/setup.mjs` and show the result.
  - If setup stops (for example Python is missing), show the user the exact install line
    it printed, and stop.
- If `node` itself is missing, Claude cannot run the skill: tell the user to install
  Node 22 or later (Mac: `brew install node`, Windows: `winget install OpenJS.NodeJS.LTS`).

## Phase 1: understand the request

1. Read the user's request and the arguments.
2. **If the user gave documents, links, or a Figma file, read them first.**
   - Small input (one or two files, one link): read it yourself.
   - Big input (a folder, many pages, a large Figma file): run several subagents in
     parallel, in one message. One reads the docs, one reads the links, one reads Figma.
     Each returns: product name, what it does, who it is for, key features, brand colours,
     logo, store links, tone words.
   - Figma: use the Figma MCP tools if they are present. If not, ask the user for exported
     screens (PNG) instead.
3. Read `${CLAUDE_SKILL_DIR}/references/questions.md`.
4. **Ask only what is still missing**, with the AskUserQuestion tool. Put up to 4 questions
   in one call. The shape question must show the small layout sketches from questions.md.
5. Write down the answers as the brief (shape, length, fps, voice, music mood, end card,
   colours, logo, font). Fill gaps with the defaults:

| Setting | Default |
|---|---|
| Length | 60 s |
| Shape | 9:16 (1080 x 1920) |
| Frame rate | 60 fps |
| Voice | On, English, offline (Kokoro) |
| Music | Picked by mood from the library |
| Sound effects | On, one distinct sound per kind of motion |
| Font | Figtree |

## Phase 2: script options

Read `${CLAUDE_SKILL_DIR}/references/style.md` (pacing and the default structure).

Write **2 or 3 script options**. Each one takes a **different angle**, for example:

- **A. Problem first:** start with the pain, then the product solves it.
- **B. Feature tour:** a fast walk through the main screens.
- **C. Story of one user:** one person, one day, one moment the app helps.

Each option is a short table:

| Time | Voice line | On screen |
|---|---|---|
| 0:00 | "Life's biggest moments happen to the people we know." | Words rise one by one. Five faces pop in around them. |
| 0:04 | ... | ... |

Rules for the script:

- A voice line is short: about 6 to 14 words. Plain words.
- About 2.3 words per second of voice. A 60 s video holds about 110 to 130 words.
- The brand name moment is clear (the reveal). The music beat starts there.
- The last row is the end card with the user's end card text.

**Wait.** The user picks one, mixes them, or edits lines. Do not go on until they say yes.

## Phase 3: the plan

Make the plan. Show it as tables. Then review it yourself before you show it.

1. **Scenes:** for each section, the time, the voice line, what moves, and how it moves
   (use the motion words from style.md: rise, pop, slide, ring, burst, scroll, lock).
2. **Sound per motion:** one table, kind of motion to sound alias. One kind of motion gets
   one sound. Two different kinds never share a sound. See the mapping in audio.md.
3. **Music:** read audio.md. Map the user's mood words to Mixkit moods. Run:

   ```sh
   node ${CLAUDE_SKILL_DIR}/tools/library.mjs pick music --mood <mood1,mood2> --min <seconds> --n 3 --json
   ```

   Show the top 3 as a table: title, artist, length, mood, and the link to listen.
   Ask the user to listen and pick one. If they give their own file, use it.
4. **Photos and screens:** what you need, and where it comes from (Figma, user files,
   Unsplash search).
5. **Self-review.** Read `${CLAUDE_SKILL_DIR}/references/checklist.md`. Check the plan
   against every item that can be checked on paper: safe areas, stickers on the phone
   frame, tall screens that scroll, two captions at once, beat at the reveal, one sound
   per motion, no names next to stock faces. Fix the plan. Then tell the user, in 2 or 3
   lines, what the review changed.

**Wait** for the user to approve the plan and pick the music.

## Phase 4: build

### 4.1 Make the video folder

Pick a short folder name in kebab-case, for example `acme-launch-60s`.

```sh
node ${CLAUDE_SKILL_DIR}/template/tools/new.mjs <video-name> --shape 9:16 --fps 60
```

It makes `<REEL_HOME>/<video-name>/` from the template. All later commands run inside
that folder. Then read `${CLAUDE_SKILL_DIR}/template/API.md`.

### 4.2 Get the assets in parallel

These five jobs do not depend on each other. Run them at the same time (parallel tool
calls, or subagents for the slow ones).

| Job | How |
|---|---|
| Music | `node ${CLAUDE_SKILL_DIR}/tools/library.mjs path <music-id>` gives the file. Then `<python> ${CLAUDE_SKILL_DIR}/tools/beats.py <file> --ffmpeg <ffmpeg>` prints JSON: the beat, the drop, and the loud and quiet parts. A track the user gives goes in `audio.json` as `music.file` (a plain path). |
| Sound effects | For each motion kind in the plan: `node ${CLAUDE_SKILL_DIR}/tools/library.mjs pick sfx --tag <tag> --max 2 --n 5 --json`. Pick one id per kind. Then `library.mjs path <id>` for each. |
| Photos | Use WebSearch with `site:unsplash.com/photos <words>`. Collect 6 to 12 photo page links. Run `node ${CLAUDE_SKILL_DIR}/tools/photos.mjs fetch <link> <link> ... --out public/photos`. Look at what downloaded (Read the images). Keep the best. A paid photo fails the download and is skipped. That is correct. `photos.mjs credits public/photos` prints the lines for CREDITS.md. If search is not available, or the photos are poor, ask the user for their own. |
| Screens | Figma MCP if present: export each frame at 2x or 3x into `public/screens/`. Else use the user's PNG files. Record each screen's real height. |
| Voice | Write the lines into the project as API.md says. Run `<python> tools/vo.py --voice <voice>`. It writes one WAV per line and their lengths. |

`<python>` is the output of `node ${CLAUDE_SKILL_DIR}/tools/config.mjs get python`.
`<ffmpeg>` is the output of `node ${CLAUDE_SKILL_DIR}/tools/config.mjs get ffmpeg <video-folder>`
(it exists after `new.mjs` has installed the project).

Write `audio.json` in the video folder: the music id with its segments, and the sound
alias map (format in audio.md). Scenes and cues use the alias (`lock`), never a file path.

Write `CREDITS.md` in the video folder: every track, sound and photo, with its source page
and licence. Photos list the page link and the photographer.

### 4.3 Write the timeline and the scenes

1. **`src/cues.ts` first.** It is the one timeline. Every motion, voice line, sound effect
   and music join reads its time from it.
   - Set the beat grid from beats.py (beat length and first beat).
   - Put section starts on beats.
   - Put the brand reveal on the music drop. Music starts there, not before or after.
   - Each section is long enough for its voice line plus about 0.4 to 0.8 s of air.
     Voice lengths come from vo.py (`vo(key)` in cues.ts, see API.md).
   - If the track has a long quiet part, jump over it (see audio.md "Music joins").
2. **Scenes next.** Follow `template/API.md` for the building blocks and the layout.
   Follow `style.md` for motion. Place things in the safe area of the shape, not at fixed
   pixels.

## Phase 5: draft and check

```sh
node tools/render.mjs --draft
node tools/sheet.mjs
```

The draft is fast (lower fps and size). The contact sheet is one image of frames across
the video. Read the sheet image yourself. Look at every frame.

Go through `${CLAUDE_SKILL_DIR}/references/checklist.md`, every item. For each problem:
note the time, fix `cues.ts` or the scene, render the draft again, and look again.

Do not show the user a draft with a problem you can see.

## Phase 6: final render and mix

```sh
node tools/render.mjs
npm run mix
```

`mix.ts` builds the sound from `cues.ts` and `audio.json`, then makes:

- `out/<video-name>.mp4` (full quality)
- `out/<video-name>-web.mp4` (under 15 MB, for a web page)

`npm run mix` prints the loudness numbers at the end. Compare them with audio.md. Then
report to the user:

1. The MP4 path (full path).
2. The loudness numbers: whole mix, voice parts, music-only parts.
3. **"I cannot hear audio. Please listen once before you share it."**
4. A one-line offer: "Do you want a web page with the video, to share with the team?"
   If yes, make an artifact page with the `-web.mp4` file.
5. "To change something, tell me the time and the change, for example: at 0:21, make the
   calendar bigger."

## Phase 7: corrections

The user sends changes by time: "at 0:21, do X".

1. Find the section and cue at that time in `cues.ts`.
2. Make the change in `cues.ts` or the scene. If a voice line changes, run vo.py for that
   line again and check the section is still long enough.
3. Render a draft of that part only (`node tools/render.mjs --draft --range <from> <to>`),
   make the contact sheet (`node tools/sheet.mjs --range <from> <to>`), check it.
4. Render the final, mix, measure, and send the new MP4 path with a short list of what
   changed.

Many notes in one message: fix them all, then render once.

## Limits to tell the user when they matter

- English voice only.
- Claude cannot hear the audio. A person must listen.
- Music and sounds are from Mixkit: free for company videos on YouTube and social media.
  Not for TV or radio, and the files cannot be re-sold.
