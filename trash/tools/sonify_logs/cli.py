from __future__ import annotations

import argparse
import os
import re
import sys
import time
from pathlib import Path
from typing import Iterable

from .audio import play_tone


DEFAULT_MAP = [
    (re.compile(r"\b(error|failed|exception)\b", re.I), 220.0),
    (re.compile(r"\bwarn(ing)?\b", re.I), 392.0),
    (re.compile(r"\b(info)\b", re.I), 523.25),
]


def iter_lines(source: str | None, follow: bool) -> Iterable[str]:
    if source in (None, "-"):
        for ln in sys.stdin:
            yield ln.rstrip("\n")
        return

    path = Path(source)
    if not path.exists():
        raise SystemExit(f"No such file: {source}")

    with path.open('r', encoding='utf-8', errors='replace') as f:
        if follow:
            f.seek(0, os.SEEK_END)
            while True:
                pos = f.tell()
                ln = f.readline()
                if ln:
                    yield ln.rstrip("\n")
                else:
                    time.sleep(0.1)
                    f.seek(pos)
        else:
            for ln in f:
                yield ln.rstrip("\n")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="Sonified Debugger for Logs")
    p.add_argument("source", nargs="?", default="-", help="Log file to read or - for stdin")
    p.add_argument("--follow", action="store_true", help="Tail and follow new lines")
    p.add_argument("--quiet", action="store_true", help="Do not echo lines, only play tones")
    p.add_argument("--volume", type=float, default=0.6, help="Volume 0..1")
    p.add_argument("--dur", type=int, default=120, help="Tone duration in ms")
    args = p.parse_args(argv)

    print("[sonify] source=", args.source, "follow=", args.follow)
    for ln in iter_lines(args.source, args.follow):
        freq = None
        for rx, hz in DEFAULT_MAP:
            if rx.search(ln):
                freq = hz
                break
        if freq is None:
            # A soft tick for unmatched lines
            freq = 880.0
        try:
            play_tone(freq=freq, duration_ms=args.dur, volume=args.volume)
        except Exception:
            pass
        if not args.quiet:
            print(ln)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

