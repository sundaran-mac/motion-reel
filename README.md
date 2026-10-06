# motion-reel

A Claude Code skill, `reel`, that makes short motion graphics videos.

## What it makes

You tell Claude what the video is about. Claude asks a few short questions, writes 2 or 3
script options, and waits for you to pick one. Then it builds the video in
[Motion Canvas](https://motioncanvas.io): animated text, app screens, photos, sound effects,
background music and an offline voice-over. You get an MP4 for a reel, YouTube, a feed post or
a square post. You can then ask for fixes by time, for example "at 0:21, make the calendar
bigger".

## Install

In Claude Code, type these two commands:

```
/plugin marketplace add sundaran-mac/motion-reel
/plugin install reel@motion-reel
```

To get a newer version later:

```
/plugin marketplace update motion-reel
```

## One-time setup on each machine

Setup downloads the voice model, the render browser and the Python packages. Run it once per
machine. It is safe to run again: finished steps are skipped.

You need **Node 22 or later**. Setup prints the exact install line for anything missing.

The easy way: in Claude Code, ask "set up the reel skill". Claude runs the setup script for you.

Or run it yourself from a copy of this repository.

**Mac (Apple Silicon), in Terminal**

```
git clone https://github.com/sundaran-mac/motion-reel.git
bash motion-reel/skills/reel/setup.sh
```

**Windows (x64), in PowerShell**

```
git clone https://github.com/sundaran-mac/motion-reel.git
powershell -ExecutionPolicy Bypass -File motion-reel\skills\reel\setup.ps1
```

Add `--check` to only see what is ready, without changing anything.

What setup needs and downloads:

| Part | From | Size |
|---|---|---|
| Python 3.10 or later | you install it; setup prints the line (`brew install python@3.12` or `winget install Python.Python.3.12`) | |
| Voice packages (kokoro-onnx, soundfile, numpy) | PyPI, into a private Python venv | about 160 MB |
| Voice model (Kokoro v1.0) | the kokoro-onnx GitHub release | 337 MB |
| Render browser (Chrome for Testing) | Google | about 190 MB download, 360 MB on disk |
| Audio catalog (list of tracks and sounds) | mixkit.co | small, about 5 minutes to build |

In total, plan for about 1 GB of disk space. ffmpeg is not part of setup: each video project
brings its own copy through npm.

## How to use

In Claude Code, type `/reel:reel`, or just ask for a video. For example:

> Make a 30 second reel for our new booking app. The audience is small shop owners.
> Use the screens in ~/Desktop/booking-screens. Calm music, with a voice-over.

## Where files go

Everything lives in one folder in your home folder:

```
~/Reels/                       (Windows: C:\Users\<name>\Reels\)
  .library/                    shared by all videos: voice model, browser, catalog, music, sounds
  <video-name>/
    out/<video-name>.mp4       full quality
    out/<video-name>-web.mp4   under 15 MB, for sharing on a page
    CREDITS.md                 every track, sound and photo, with its source and licence
```

Set the `REEL_HOME` environment variable to use another folder.

## What it needs from you

- **Listen to the video before you share it.** Claude cannot hear audio. It measures the
  loudness, but a person must listen.
- No API keys and no accounts. The voice runs offline on your machine, so your script never
  leaves it.

## Licences of downloaded media

- **Music and sound effects** come from [Mixkit](https://mixkit.co) under its free licences.
  They are free for company videos on YouTube and social media, with no credit needed. Not
  allowed: TV or radio broadcast, re-selling the files, or claiming the tracks as yours.
- **Photos** come from [Unsplash](https://unsplash.com) under the Unsplash licence. Paid
  Unsplash+ photos are skipped.
- These files are downloaded to your machine only. They are never committed to this
  repository.

## Limits

- Claude cannot hear the audio; a person must listen before the video is shared.
- English voice only.
- Intel Macs and Windows on ARM are not supported in the first version.
- People in stock photos are models, so the video never puts a name or a quote next to a face.
- Mixkit can change its pages. The catalog is built once and kept, so an old catalog keeps
  working if a rebuild fails.

## Credits

- [Motion Canvas](https://motioncanvas.io) draws and animates the video.
- [Kokoro](https://huggingface.co/hexgrad/Kokoro-82M), through
  [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx), makes the offline voice.
- [ffmpeg](https://ffmpeg.org) mixes the sound and encodes the video.

The full design is in [docs/spec.md](docs/spec.md).

## Licence

Our code is under the MIT licence (see `LICENSE`). It covers this repository only. Music,
sound effects and photos are downloaded under their own free licences and are never stored here.
