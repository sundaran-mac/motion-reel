"""Make one WAV per voice line with the local Kokoro model. Offline: the text never leaves
the machine.

Reads vo.json ({"key": "text", ...}) in the project folder and writes:
  public/vo/<key>.wav         one file per line
  public/vo/durations.json    seconds per line
  src/vo.ts                   the same durations, for src/cues.ts

Usage: <python> tools/vo.py [--voice af_heart] [--speed 1.0] [--model-dir DIR] [--only key1,key2]
Model dir: --model-dir, else env REEL_KOKORO_DIR, else <REEL_HOME>/.library/kokoro.
Voice and speed: the flags, else env REEL_VOICE and REEL_SPEED, else af_heart and 1.0.
Voices starting with "b" (bf_emma, bm_george) speak British English; the rest American.
"""
import argparse
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


def default_model_dir():
    if os.environ.get("REEL_KOKORO_DIR"):
        return os.environ["REEL_KOKORO_DIR"]
    home = os.environ.get("REEL_HOME") or os.path.join(os.path.expanduser("~"), "Reels")
    return os.path.join(home, ".library", "kokoro")


def main():
    ap = argparse.ArgumentParser(description="Voice lines from vo.json with Kokoro.")
    ap.add_argument("--voice", default=os.environ.get("REEL_VOICE", "af_heart"))
    ap.add_argument("--speed", type=float, default=float(os.environ.get("REEL_SPEED", "1.0")))
    ap.add_argument("--model-dir", default=default_model_dir())
    ap.add_argument("--only", default="", help="comma separated keys to remake; the rest are kept")
    a = ap.parse_args()

    model = os.path.join(a.model_dir, "kokoro-v1.0.onnx")
    voices = os.path.join(a.model_dir, "voices-v1.0.bin")
    for f in (model, voices):
        if not os.path.exists(f):
            sys.exit(f"vo: missing {f}. Run the skill setup, or pass --model-dir.")

    with open(os.path.join(ROOT, "vo.json"), encoding="utf-8") as fh:
        lines = json.load(fh)
    only = {k for k in a.only.split(",") if k}
    unknown = only - set(lines)
    if unknown:
        sys.exit(f"vo: not in vo.json: {', '.join(sorted(unknown))}")

    from kokoro_onnx import Kokoro
    import soundfile as sf

    out = os.path.join(ROOT, "public", "vo")
    os.makedirs(out, exist_ok=True)
    dur_path = os.path.join(out, "durations.json")
    durations = {}
    if only and os.path.exists(dur_path):
        with open(dur_path, encoding="utf-8") as fh:
            durations = json.load(fh)

    lang = "en-gb" if a.voice.startswith("b") else "en-us"
    k = Kokoro(model, voices)
    for key, text in lines.items():
        if only and key not in only:
            continue
        samples, rate = k.create(text, voice=a.voice, speed=a.speed, lang=lang)
        sf.write(os.path.join(out, f"{key}.wav"), samples, rate)
        durations[key] = round(len(samples) / rate, 3)
        print(f"{key}: {durations[key]} s")
    # Keep only keys that are still in vo.json, in vo.json order.
    durations = {k2: durations[k2] for k2 in lines if k2 in durations}

    with open(dur_path, "w", encoding="utf-8") as fh:
        json.dump(durations, fh, indent=1)
    body = ",\n".join(f"  {json.dumps(k2)}: {v}" for k2, v in durations.items())
    with open(os.path.join(ROOT, "src", "vo.ts"), "w", encoding="utf-8") as fh:
        fh.write(
            "// Written by tools/vo.py from public/vo/durations.json. Seconds per voice line.\n"
            f"export const VO_DUR: Record<string, number> = {{\n{body}\n}};\n"
        )
    print("total", round(sum(durations.values()), 2), "s")


if __name__ == "__main__":
    main()
