#!/usr/bin/env python3
"""Find the beat, the drop and the loud and quiet parts of a music track.

    python beats.py <audio-file> [--ffmpeg PATH]

Needs Python 3.10+, numpy, and an ffmpeg binary (from --ffmpeg or env REEL_FFMPEG).
Prints one JSON object:

    duration   track length in seconds
    bpm        beats per minute
    beat       seconds per beat
    firstBeat  time of the first beat on the beat grid
    drop       the strongest onset right after a quiet dip (where the track kicks in)
    loud       [[start, end], ...] parts clearly louder than a quiet part
    quiet      [[start, end], ...] parts well below the track's usual level
    onsets     times of the strong onsets (hits), in order

Method: an RMS envelope (hop 256 samples at 22050 Hz), tempo from the autocorrelation of
the positive energy changes within 0.3 to 1.0 s, loud and quiet parts from a 0.5 s smoothed
envelope measured in dB against the track's median.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys

import numpy as np

SR = 22050
HOP = 256
FPS = SR / HOP  # envelope frames per second

QUIET_DB = -10.0   # below the median by this much is quiet
LOUD_DB = -8.0     # above this (relative to the median) is loud
HIT_DB = -4.0      # a drop's first hit reaches at least this (relative to the median)
MIN_PART_S = 2.0   # shorter parts are dropped
MERGE_GAP_S = 1.5  # parts closer than this are joined


def decode(path: str, ffmpeg: str) -> np.ndarray:
    cmd = [ffmpeg, '-v', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-']
    try:
        out = subprocess.run(cmd, capture_output=True, check=True).stdout
    except FileNotFoundError:
        sys.exit(f'ffmpeg not found at {ffmpeg}')
    except subprocess.CalledProcessError as e:
        sys.exit(f'ffmpeg could not read {path}: {e.stderr.decode(errors="replace").strip()}')
    x = np.frombuffer(out, dtype='<f4')
    if x.size < SR:
        sys.exit(f'{path} is shorter than one second or has no audio')
    return x


def rms_envelope(x: np.ndarray) -> np.ndarray:
    n = len(x) // HOP
    return np.sqrt((x[: n * HOP].reshape(n, HOP).astype(np.float64) ** 2).mean(axis=1))


def smooth(a: np.ndarray, seconds: float) -> np.ndarray:
    k = max(1, int(round(seconds * FPS)))
    return np.convolve(a, np.ones(k) / k, mode='same')


def to_db(a: np.ndarray) -> np.ndarray:
    return 20 * np.log10(np.maximum(a, 1e-9))


def tempo(flux: np.ndarray) -> float:
    """Beat period in seconds, from the autocorrelation of the onset strength (0.3 to 1.0 s)."""
    f = flux - flux.mean()
    n = len(f)
    size = 1 << int(np.ceil(np.log2(2 * n)))
    spec = np.fft.rfft(f, size)
    ac = np.fft.irfft(spec * np.conj(spec), size)[:n]
    lags = np.arange(int(0.3 * FPS), int(1.0 * FPS) + 1)
    score = ac[lags]
    i = int(np.argmax(score))
    lag = float(lags[i])
    if 0 < i < len(score) - 1:  # parabolic peak refinement
        a, b, c = score[i - 1], score[i], score[i + 1]
        den = a - 2 * b + c
        if den != 0:
            lag += 0.5 * (a - c) / den
    return lag / FPS


def grid_fit(flux: np.ndarray, period_s: float) -> tuple[float, float]:
    """Fine-tune the period (within 1 percent) and find the grid offset with the most energy.

    One envelope frame is about 12 ms, so the autocorrelation alone can be a little off,
    and that error grows over a long track. Returns (period_s, offset_s).
    """
    best = (-1.0, period_s, 0.0)
    for e in np.linspace(-0.01, 0.01, 41):
        p = period_s * (1 + e) * FPS
        count = int((len(flux) - p) / p)
        if count < 2:
            continue
        for off in np.arange(0.0, p, 0.5):
            idx = np.round(off + p * np.arange(count)).astype(int)
            s = float(flux[idx[idx < len(flux)]].sum())
            if s > best[0]:
                best = (s, p / FPS, off / FPS)
    return best[1], best[2]


def peaks(flux: np.ndarray, min_gap_s: float = 0.12, threshold_std: float = 2.0) -> np.ndarray:
    """Frames that are local maxima above mean + threshold_std * std, at least min_gap_s apart."""
    thr = flux.mean() + threshold_std * flux.std()
    cand = np.where((flux[1:-1] > flux[:-2]) & (flux[1:-1] >= flux[2:]) & (flux[1:-1] > thr))[0] + 1
    order = cand[np.argsort(-flux[cand])]
    gap = int(min_gap_s * FPS)
    taken: list[int] = []
    for c in order:
        if all(abs(c - t) > gap for t in taken):
            taken.append(int(c))
    return np.array(sorted(taken), dtype=int)


def parts(mask: np.ndarray) -> list[list[float]]:
    """Runs of True as [start, end] seconds, joined over short gaps, short runs dropped."""
    runs: list[list[int]] = []
    start = None
    for i, v in enumerate(np.append(mask, False)):
        if v and start is None:
            start = i
        elif not v and start is not None:
            runs.append([start, i])
            start = None
    merged: list[list[int]] = []
    for r in runs:
        if merged and (r[0] - merged[-1][1]) / FPS < MERGE_GAP_S:
            merged[-1][1] = r[1]
        else:
            merged.append(r)
    return [[round(a / FPS, 2), round(b / FPS, 2)] for a, b in merged if (b - a) / FPS >= MIN_PART_S]


def find_drop(env_db: np.ndarray, med_db: float) -> float | None:
    """Where the track kicks in: a real hit right after a quiet dip, with loud music after it.

    Candidates come from the change of the envelope in dB, so the first hit after a
    silence counts even when a bigger hit follows a moment later. The biggest rise wins.
    """
    rise = np.maximum(np.diff(env_db, prepend=env_db[0]), 0)
    pre, post, near = int(0.6 * FPS), int(1.5 * FPS), 3
    best, best_t = 0.0, None
    for f in peaks(rise):
        if f < pre or f + post > len(env_db):
            continue
        before = float(np.median(env_db[f - pre: f - 1]))
        after = float(np.median(env_db[f: f + post]))
        hit = float(env_db[f: f + near].max())
        if before > med_db + QUIET_DB or after < med_db + LOUD_DB or hit < med_db + HIT_DB:
            continue  # no quiet dip, not loud after it, or only a tick in the silence
        if after - before > best:
            best, best_t = after - before, f / FPS
    return best_t


def analyse(x: np.ndarray) -> dict:
    env = rms_envelope(x)
    env_db = to_db(env)
    # Onset strength: the positive change of the energy (RMS squared) from frame to frame.
    flux = np.maximum(np.diff(env ** 2, prepend=0.0), 0.0)

    period, offset = grid_fit(flux, tempo(flux))

    sm_db = to_db(smooth(env, 0.5))
    med = float(np.median(sm_db))
    loud = parts(sm_db > med + LOUD_DB)
    quiet = parts(sm_db < med + QUIET_DB)

    drop = find_drop(env_db, med)
    # A drop lands on a beat, so when there is one the grid is anchored to it. Without a
    # drop the grid uses the offset with the most energy, which on tracks with many even
    # hits per beat can sit a fraction of a beat early.
    anchor = drop if drop is not None else offset
    first = anchor % period

    return {
        'duration': round(len(x) / SR, 3),
        'bpm': round(60 / period, 2),
        'beat': round(period, 4),
        'firstBeat': round(first, 3),
        'drop': None if drop is None else round(drop, 3),
        'loud': loud,
        'quiet': quiet,
        'onsets': [round(f / FPS, 3) for f in peaks(flux, threshold_std=3)],
    }


def main() -> None:
    ap = argparse.ArgumentParser(description='Beat, drop, loud and quiet parts of a track.')
    ap.add_argument('audio')
    ap.add_argument('--ffmpeg', default=os.environ.get('REEL_FFMPEG'))
    a = ap.parse_args()
    if not a.ffmpeg:
        sys.exit('ffmpeg path missing: pass --ffmpeg PATH or set REEL_FFMPEG')
    if not os.path.isfile(a.audio):
        sys.exit(f'no such file: {a.audio}')
    print(json.dumps(analyse(decode(a.audio, a.ffmpeg))))


if __name__ == '__main__':
    main()
