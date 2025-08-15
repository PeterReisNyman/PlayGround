from __future__ import annotations

import shutil
import time
from typing import Iterable

from .automata import Automaton


def render_to_terminal(auto: Automaton, fps: float = 10.0, steps: int | None = None) -> None:
    sleep = 1.0 / max(1e-6, fps)
    count = 0
    try:
        while steps is None or count < steps:
            lines = auto.as_lines()
            cols = shutil.get_terminal_size((80, 24)).columns
            print("\x1b[H\x1b[2J", end="")  # clear screen
            for line in lines:
                if len(line) > cols:
                    print(line[: cols])
                else:
                    print(line)
            time.sleep(sleep)
            auto.step()
            count += 1
    except KeyboardInterrupt:
        pass

