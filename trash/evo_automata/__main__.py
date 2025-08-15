from __future__ import annotations

import argparse
import random

from .automata import Rule, Automaton
from .evolver import evolve
from .renderer import render_to_terminal


def main() -> None:
    parser = argparse.ArgumentParser(description="Evolving Life-like cellular automata demo")
    parser.add_argument("--rule", default="B3/S23", help="Initial rule in B*/S* notation")
    parser.add_argument("--width", type=int, default=64)
    parser.add_argument("--height", type=int, default=32)
    parser.add_argument("--steps", type=int, default=200, help="Number of steps; 0 or negative for infinite until Ctrl+C")
    parser.add_argument("--fps", type=float, default=15.0)
    parser.add_argument("--density", type=float, default=0.25)
    parser.add_argument("--evolve", action="store_true", help="Run rule evolution before rendering")
    parser.add_argument("--save-best", type=str, default="", help="Path to save selected rule as JSONL (append)")
    args = parser.parse_args()

    rule = Rule.parse(args.rule)
    if args.evolve:
        result = evolve(rule, width=args.width, height=args.height, steps=50, density=args.density, rounds=8)
        rule = result.rule
        b = ''.join(map(str, sorted(rule.birth)))
        s = ''.join(map(str, sorted(rule.survive)))
        print(f"Selected rule: B{b}/S{s} (score={result.score:.3f})")
        if args.save_best:
            import json, time
            with open(args.save_best, "a", encoding="utf-8") as f:
                f.write(json.dumps({
                    "timestamp": int(time.time()),
                    "rule": {"B": b, "S": s},
                    "score": result.score,
                    "width": args.width,
                    "height": args.height,
                }) + "\n")

    auto = Automaton(args.width, args.height, rule)
    auto.seed_random(args.density, rng=random.Random(42))
    steps = None if args.steps <= 0 else args.steps
    render_to_terminal(auto, fps=args.fps, steps=steps)


if __name__ == "__main__":
    main()
