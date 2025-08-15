from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, Tuple
import random


Coord = Tuple[int, int]


@dataclass(frozen=True)
class Rule:
    """Life-like rule: B/S notation (birth/survival neighbor counts).

    Example: Conway's Life is B3/S23.
    """

    birth: frozenset[int]
    survive: frozenset[int]

    @staticmethod
    def parse(spec: str) -> "Rule":
        spec = spec.upper().replace(" ", "")
        if "/" not in spec or not spec:
            raise ValueError("Invalid rule spec; expected format like 'B3/S23'")
        bpart, spart = spec.split("/")
        if not (bpart.startswith("B") and spart.startswith("S")):
            raise ValueError("Invalid rule spec; must start with B and S")
        b = frozenset(int(ch) for ch in bpart[1:] if ch.isdigit())
        s = frozenset(int(ch) for ch in spart[1:] if ch.isdigit())
        return Rule(birth=b, survive=s)

    def mutate(self, p: float = 0.2) -> "Rule":
        """Return a slightly mutated rule by toggling neighbor counts with prob p."""
        def toggle(fs: frozenset[int]) -> frozenset[int]:
            s = set(fs)
            for n in range(9):  # 0..8 neighbors
                if random.random() < p:
                    if n in s:
                        s.remove(n)
                    else:
                        s.add(n)
            return frozenset(s)

        return Rule(toggle(self.birth), toggle(self.survive))


class Automaton:
    def __init__(self, width: int, height: int, rule: Rule, wrap: bool = True):
        self.w = width
        self.h = height
        self.rule = rule
        self.wrap = wrap
        self.grid = [[0] * width for _ in range(height)]

    def seed_random(self, density: float = 0.2, rng: random.Random | None = None) -> None:
        r = rng or random
        for y in range(self.h):
            for x in range(self.w):
                self.grid[y][x] = 1 if r.random() < density else 0

    def neighbors(self, x: int, y: int) -> Iterable[Coord]:
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = x + dx, y + dy
                if self.wrap:
                    nx %= self.w
                    ny %= self.h
                    yield nx, ny
                else:
                    if 0 <= nx < self.w and 0 <= ny < self.h:
                        yield nx, ny

    def step(self) -> None:
        nxt = [[0] * self.w for _ in range(self.h)]
        for y in range(self.h):
            row = self.grid[y]
            for x in range(self.w):
                n = 0
                for nx, ny in self.neighbors(x, y):
                    n += self.grid[ny][nx]
                alive = row[x] == 1
                if alive:
                    nxt[y][x] = 1 if n in self.rule.survive else 0
                else:
                    nxt[y][x] = 1 if n in self.rule.birth else 0
        self.grid = nxt

    def population(self) -> int:
        return sum(sum(row) for row in self.grid)

    def as_lines(self, on: str = "█", off: str = " ") -> list[str]:
        return ["".join(on if c else off for c in row) for row in self.grid]

