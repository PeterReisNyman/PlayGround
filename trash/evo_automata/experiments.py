from __future__ import annotations

import argparse
import csv
import itertools
import json
import os
import time
from dataclasses import dataclass
from typing import Iterable

from .automata import Rule
from .evolver import evolve


@dataclass
class Sweep:
    rules: list[str]
    widths: list[int]
    heights: list[int]
    steps: list[int]
    densities: list[float]
    rounds: list[int]
    population_sizes: list[int]
    mutation_rates: list[float]


def _parse_csv_list(text: str, cast):
    return [cast(x) for x in text.split(",") if x != ""]


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def _timestamp() -> int:
    return int(time.time())


def run_sweep(sweep: Sweep, outdir: str) -> int:
    _ensure_dir(outdir)
    jsonl_path = os.path.join(outdir, "results.jsonl")
    csv_path = os.path.join(outdir, "results.csv")
    total = 0

    # Prepare CSV header
    fieldnames = [
        "timestamp",
        "rule_B",
        "rule_S",
        "width",
        "height",
        "steps",
        "density",
        "rounds",
        "population_size",
        "mutation_rate",
        "score",
    ]
    if not os.path.exists(csv_path):
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

    for rule_str, w, h, st, d, r, pop, mr in itertools.product(
        sweep.rules,
        sweep.widths,
        sweep.heights,
        sweep.steps,
        sweep.densities,
        sweep.rounds,
        sweep.population_sizes,
        sweep.mutation_rates,
    ):
        rule = Rule.parse(rule_str)
        result = evolve(
            rule,
            width=w,
            height=h,
            steps=max(10, int(st)),
            density=d,
            population_size=max(2, int(pop)),
            mutation_rate=mr,
            rounds=r,
        )
        b = "".join(map(str, sorted(result.rule.birth)))
        s = "".join(map(str, sorted(result.rule.survive)))
        rec = {
            "timestamp": _timestamp(),
            "rule_B": b,
            "rule_S": s,
            "width": w,
            "height": h,
            "steps": st,
            "density": d,
            "rounds": r,
            "population_size": pop,
            "mutation_rate": mr,
            "score": result.score,
        }
        with open(jsonl_path, "a", encoding="utf-8") as jf:
            jf.write(json.dumps(rec) + "\n")
        with open(csv_path, "a", newline="", encoding="utf-8") as cf:
            writer = csv.DictWriter(cf, fieldnames=fieldnames)
            writer.writerow(rec)
        total += 1
    return total


def main() -> None:
    parser = argparse.ArgumentParser(description="Run parameter sweeps and store results as JSONL/CSV")
    parser.add_argument("--rules", default="B3/S23", help="Comma-separated rules (e.g., B3/S23,B36/S23)")
    parser.add_argument("--widths", default="64", help="Comma-separated widths")
    parser.add_argument("--heights", default="32", help="Comma-separated heights")
    parser.add_argument("--steps", default="50", help="Comma-separated steps for evaluation per candidate")
    parser.add_argument("--densities", default="0.25", help="Comma-separated initial densities")
    parser.add_argument("--rounds", default="8", help="Comma-separated evolution rounds")
    parser.add_argument("--population-sizes", default="8", help="Comma-separated candidate counts per round")
    parser.add_argument("--mutation-rates", default="0.2", help="Comma-separated mutation rates")
    parser.add_argument("--outdir", default=None, help="Output directory; default runs/exp_<timestamp>")
    args = parser.parse_args()

    outdir = args.outdir or os.path.join("runs", f"exp_{_timestamp()}")
    sweep = Sweep(
        rules=_parse_csv_list(args.rules, str),
        widths=_parse_csv_list(args.widths, int),
        heights=_parse_csv_list(args.heights, int),
        steps=_parse_csv_list(args.steps, int),
        densities=_parse_csv_list(args.densities, float),
        rounds=_parse_csv_list(args.rounds, int),
        population_sizes=_parse_csv_list(args.population_sizes, int),
        mutation_rates=_parse_csv_list(args.mutation_rates, float),
    )

    count = run_sweep(sweep, outdir)
    print(f"Wrote {count} results to {outdir}")


if __name__ == "__main__":
    main()

