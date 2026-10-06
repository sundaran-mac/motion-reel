# The questions

Ask only what the request and the documents do not answer.

## Rules

- **Read the documents first.** Then ask. Never ask what a document already says.
- **Use the AskUserQuestion tool.** Put up to 4 questions in one call. If you need more
  than 4, make a second call after the first is answered.
- **Plain, short English.** A short question. A short label for each option. One line
  under each option saying what it means.
- **Show a small example under each option** (a sketch, a sample line, a sample value).
- **Always allow "Other".** The user can type their own answer.
- **Defaults count as answers.** If the user says "you pick" or "default", use the
  default and move on.

Good order for the first call: 1 (shape), 2 (length), 5 (voice), 6 (music mood).
Ask 3, 4, 7, 8 only when the request and docs are silent on them.

## 1. Where will the video be posted?

Header: `Shape`. Default: Reel, Shorts or Status.

| Label | Description |
|---|---|
| Reel, Shorts or Status (9:16) | Tall video for phones. 1080 x 1920. Instagram Reels, YouTube Shorts, WhatsApp Status. |
| YouTube (16:9) | Wide video for laptops and TV. 1920 x 1080. |
| Feed post (4:5) | Slightly tall. 1080 x 1350. Instagram or LinkedIn feed. |
| Square (1:1) | 1080 x 1080. Works almost everywhere. |

Show these sketches as the option previews:

```
Reel, Shorts, Status (9:16)
+---------+
|  TITLE  |
|         |
| +-----+ |
| |phone| |
| |     | |
| +-----+ |
|         |
| caption |
+---------+
```

```
YouTube (16:9)
+--------------------+
| TITLE     +------+ |
| caption   |phone | |
| caption   |      | |
|           +------+ |
+--------------------+
```

```
Feed post (4:5)
+-----------+
|   TITLE   |
|  +-----+  |
|  |phone|  |
|  +-----+  |
|  caption  |
+-----------+
```

```
Square (1:1)
+---------+
|  TITLE  |
| +-----+ |
| |phone| |
| +-----+ |
| caption |
+---------+
```

## 2. How long?

Header: `Length`. Default: 60 s.

| Label | Description |
|---|---|
| 15 s | One idea and the end card. Good for ads. |
| 30 s | Hook, 2 or 3 features, end card. |
| 60 s | Hook, why, features, trust, end card. The full story. |
| 90 s | More features, slower pace. Good for YouTube. |

## 3. What is it about, and who will watch it?

Header: `Topic`. Free text. Ask only if the request and docs do not say.

| Label | Description |
|---|---|
| I will type it | Example: "Our app helps families plan events. For parents in India." |
| I will add documents | You give a folder, a link or a Figma file. I read it and find the answer. |

## 4. Any documents, links or Figma file?

Header: `Sources`. Ask only if the user did not give any.

| Label | Description |
|---|---|
| A folder path | Example: `~/Documents/acme-docs`. I read every file in it. |
| A link | Example: `https://acme.com`. I read the page. |
| A Figma link | Example: `https://figma.com/design/...`. I take the app screens from it. |
| None | I work from what you typed. |

## 5. Voice-over?

Header: `Voice`. Default: On, voice `af_heart`.

| Label | Description |
|---|---|
| On, warm female (af_heart) | Friendly and clear. American English. Used in the Humini LIVE reel. |
| On, calm male (am_michael) | Steady and warm. American English. |
| On, British female (bf_emma) | Clear and calm. British English. |
| Off | Text on screen only, with music and sound effects. |

The voice runs offline. The script never leaves this machine. English only.
If the user wants to hear the voices first, make one short sample line per voice with
vo.py and give the file paths.

## 6. Music mood?

Header: `Music`. Default: Upbeat.

| Label | Description |
|---|---|
| Upbeat | Happy, bright, a clear beat. Good for apps and launches. |
| Calm | Soft and gentle. Good for health, care, finance. |
| Emotional | Warm and moving. Good for stories about people. |
| Cinematic | Big and dramatic, with a strong drop. Good for a reveal. |
| Tech | Electronic, modern, clean. Good for software and tools. |

After the answer, run `library.mjs pick music ... --json` and show the top 3 tracks with
links to listen. The user picks one. They can also give their own music file.

## 7. End card text?

Header: `End card`. Ask only if the docs do not say.

| Label | Description |
|---|---|
| Store badges | "Now on the App Store and Google Play". |
| Website | Example: "acme.com". |
| Sign up now | Example: "Sign up free at acme.com". |
| Coming soon | Example: "Coming soon. Join the waitlist." |

## 8. Brand colours and logo?

Header: `Brand`. Take them from the docs or Figma when present. Ask only if missing.

| Label | Description |
|---|---|
| I will give them | Example: main colour `#FF9A00`, logo file `~/Downloads/logo.svg`. |
| Take them from Figma | I read the colours and the logo from the Figma file. |
| You pick | I choose a clean palette. The product name is used as a text logo. |

## After the answers

Write the brief back in one short table (shape, length, fps, voice, mood, end card,
colours, font). Do not ask "is this right?" as a separate step. Go to the script options.
The user can correct the brief there.
