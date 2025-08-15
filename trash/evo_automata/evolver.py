from __future__ import annotations

from dataclasses import dataclass
import random
from typing import Callable
import math

from .automata import Automaton, Rule


def score_interestingness(
    samples: list[int], width: int, height: int, spatial_entropy: list[float] | None = None
) -> float:
    """Heuristic score for how "interesting" a run is.

    - Rewards mid-level average population (avoids extinction and full saturation)
    - Rewards fluctuation over time
    - Rewards spatial entropy (diverse local patterns)
    - Bonus for staying non-trivial (never reaching 0 or full)
    Returns a value roughly within [0, ~1.6]; higher is better.
    """
    if not samples:
        return 0.0
    area = width * height
    avg = sum(samples) / len(samples)
    target = 0.25 * area
    balance = max(0.0, 1.0 - abs(avg - target) / max(1.0, target))
    # Variation over time (normalized)
    var = 0.0
    for i in range(1, len(samples)):
        var += abs(samples[i] - samples[i - 1])
    var_norm = var / max(1.0, len(samples) * area)
    # Spatial entropy (already normalized to [0,1])
    spatial_avg = 0.0
    if spatial_entropy:
        spatial_avg = sum(spatial_entropy) / len(spatial_entropy)
    # Non-triviality bonus: not extinct or full at any sampled step
    extinct = any(s == 0 for s in samples)
    full = any(s == area for s in samples)
    non_trivial = 1.0 if not extinct and not full else 0.6
    return 0.4 * balance + 0.3 * var_norm + 0.2 * spatial_avg + 0.1 * non_trivial


@dataclass
class EvolutionResult:
    rule: Rule
    score: float


def _spatial_entropy(grid: list[list[int]], w: int, h: int) -> float:
    # Entropy of 2x2 alive-counts distribution, sliding over the grid (wrap-around)
    counts = [0] * 5  # alive counts: 0..4
    for y in range(h):
        yn = (y + 1) % h
        row = grid[y]
        rown = grid[yn]
        for x in range(w):
            xn = (x + 1) % w
            alive = row[x] + row[xn] + rown[x] + rown[xn]
            counts[alive] += 1
    total = float(sum(counts)) or 1.0
    ent = 0.0
    for c in counts:
        if c:
            p = c / total
            ent -= p * math.log(p, 2)
    # Normalize by log2(5)
    return ent / math.log(5, 2)


def run_trial(rule: Rule, width: int, height: int, steps: int, density: float, seed: int | None = None) -> float:
    rng = random.Random(seed)
    automaton = Automaton(width, height, rule, wrap=True)
    automaton.seed_random(density=density, rng=rng)
    samples: list[int] = []
    spatial_series: list[float] = []
    for _ in range(steps):
        automaton.step()
        samples.append(automaton.population())
        spatial_series.append(_spatial_entropy(automaton.grid, width, height))
    return score_interestingness(samples, width, height, spatial_series)


def evolve(
    base: Rule,
    width: int = 48,
    height: int = 24,
    steps: int = 40,
    density: float = 0.25,
    population_size: int = 8,
    mutation_rate: float = 0.2,
    rounds: int = 10,
    scorer: Callable[[list[int], int, int], float] | None = None,
) -> EvolutionResult:
    best_rule = base
    best_score = run_trial(best_rule, width, height, steps, density)
    for _ in range(rounds):
        candidates = [best_rule] + [best_rule.mutate(mutation_rate) for _ in range(population_size - 1)]
        scores = [run_trial(r, width, height, steps, density) for r in candidates]
        idx = max(range(len(candidates)), key=lambda i: scores[i])
        if scores[idx] >= best_score:
            best_rule = candidates[idx]
            best_score = scores[idx]
    return EvolutionResult(rule=best_rule, score=best_score)
