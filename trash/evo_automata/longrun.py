from __future__ import annotations

import argparse
import json
import os
import signal
import sys
import time
from dataclasses import asdict, dataclass

from .automata import Rule
from .evolver import evolve


@dataclass
class Checkpoint:
    started_at: int
    last_update: int
    epochs_completed: int
    rounds_completed: int
    best_rule_B: list[int]
    best_rule_S: list[int]
    best_score: float


def _now() -> int:
    return int(time.time())


def _ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


class GracefulStop:
    def __init__(self) -> None:
        self.stop = False
        try:
            signal.signal(signal.SIGINT, self._handler)
            signal.signal(signal.SIGTERM, self._handler)
        except Exception:
            pass

    def _handler(self, signum, frame):  # noqa: ANN001
        self.stop = True


def save_checkpoint(path: str, ckpt: Checkpoint) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(asdict(ckpt), f)
    os.replace(tmp, path)


def load_checkpoint(path: str) -> Checkpoint | None:
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return Checkpoint(
        started_at=int(data.get("started_at", _now())),
        last_update=int(data.get("last_update", _now())),
        epochs_completed=int(data.get("epochs_completed", 0)),
        rounds_completed=int(data.get("rounds_completed", 0)),
        best_rule_B=list(map(int, data.get("best_rule_B", []))),
        best_rule_S=list(map(int, data.get("best_rule_S", []))),
        best_score=float(data.get("best_score", 0.0)),
    )


def append_jsonl(path: str, rec: dict) -> None:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec) + "\n")


def run_long(
    base_rule: Rule,
    width: int,
    height: int,
    steps_per_eval: int,
    density: float,
    population_size: int,
    mutation_rate: float,
    rounds_per_epoch: int,
    target_seconds: float,
    checkpoint_every_seconds: float,
    outdir: str,
    resume_checkpoint: str | None,
) -> None:
    _ensure_dir(outdir)
    logs_path = os.path.join(outdir, "results.jsonl")
    ckpt_path = os.path.join(outdir, "checkpoint.json")

    ckpt = load_checkpoint(resume_checkpoint or ckpt_path)
    if ckpt is None:
        ckpt = Checkpoint(
            started_at=_now(),
            last_update=_now(),
            epochs_completed=0,
            rounds_completed=0,
            best_rule_B=sorted(list(base_rule.birth)),
            best_rule_S=sorted(list(base_rule.survive)),
            best_score=0.0,
        )
    current_rule = Rule(frozenset(ckpt.best_rule_B), frozenset(ckpt.best_rule_S))
    best_score = ckpt.best_score

    stopper = GracefulStop()
    start_time = ckpt.started_at
    end_time = start_time + int(target_seconds)
    next_ckpt_at = time.time() + checkpoint_every_seconds

    # Initial evaluation if no score
    if best_score <= 0.0:
        initial = evolve(
            current_rule,
            width=width,
            height=height,
            steps=steps_per_eval,
            density=density,
            population_size=population_size,
            mutation_rate=mutation_rate,
            rounds=1,
        )
        current_rule = initial.rule
        best_score = initial.score
        ckpt.best_rule_B = sorted(list(current_rule.birth))
        ckpt.best_rule_S = sorted(list(current_rule.survive))
        ckpt.best_score = best_score
        append_jsonl(logs_path, {
            "ts": _now(),
            "event": "init",
            "rule_B": "".join(map(str, ckpt.best_rule_B)),
            "rule_S": "".join(map(str, ckpt.best_rule_S)),
            "score": best_score,
        })
        save_checkpoint(ckpt_path, ckpt)

    while True:
        if stopper.stop:
            break
        if time.time() >= end_time:
            break

        # One epoch = multiple rounds of evolve() seeded with current best
        result = evolve(
            current_rule,
            width=width,
            height=height,
            steps=steps_per_eval,
            density=density,
            population_size=population_size,
            mutation_rate=mutation_rate,
            rounds=rounds_per_epoch,
        )
        ckpt.epochs_completed += 1
        ckpt.rounds_completed += int(rounds_per_epoch)
        improved = result.score >= best_score
        if improved:
            current_rule = result.rule
            best_score = result.score
            ckpt.best_rule_B = sorted(list(current_rule.birth))
            ckpt.best_rule_S = sorted(list(current_rule.survive))
            ckpt.best_score = best_score
            append_jsonl(logs_path, {
                "ts": _now(),
                "event": "improve",
                "epochs_completed": ckpt.epochs_completed,
                "rounds_completed": ckpt.rounds_completed,
                "rule_B": "".join(map(str, ckpt.best_rule_B)),
                "rule_S": "".join(map(str, ckpt.best_rule_S)),
                "score": best_score,
            })

        now = time.time()
        if now >= next_ckpt_at:
            ckpt.last_update = _now()
            save_checkpoint(ckpt_path, ckpt)
            next_ckpt_at = now + checkpoint_every_seconds

    ckpt.last_update = _now()
    save_checkpoint(ckpt_path, ckpt)
    append_jsonl(logs_path, {
        "ts": _now(),
        "event": "stop",
        "epochs_completed": ckpt.epochs_completed,
        "rounds_completed": ckpt.rounds_completed,
        "rule_B": "".join(map(str, ckpt.best_rule_B)),
        "rule_S": "".join(map(str, ckpt.best_rule_S)),
        "score": ckpt.best_score,
    })


def main() -> None:
    p = argparse.ArgumentParser(description="Long-running evolution with periodic checkpoints and resume")
    p.add_argument("--rule", default="B3/S23")
    p.add_argument("--width", type=int, default=64)
    p.add_argument("--height", type=int, default=32)
    p.add_argument("--steps-per-eval", type=int, default=50)
    p.add_argument("--density", type=float, default=0.25)
    p.add_argument("--population-size", type=int, default=8)
    p.add_argument("--mutation-rate", type=float, default=0.2)
    p.add_argument("--rounds-per-epoch", type=int, default=8)
    p.add_argument("--target-hours", type=float, default=1.0, help="Total wall-time target to run before exit")
    p.add_argument("--checkpoint-every-minutes", type=float, default=10.0)
    p.add_argument("--outdir", type=str, default=None)
    p.add_argument("--resume-from", type=str, default=None)
    args = p.parse_args()

    outdir = args.outdir or os.path.join("runs", f"long_{_now()}")
    rule = Rule.parse(args.rule)
    run_long(
        base_rule=rule,
        width=args.width,
        height=args.height,
        steps_per_eval=args.steps_per_eval,
        density=args.density,
        population_size=args.population_size,
        mutation_rate=args.mutation_rate,
        rounds_per_epoch=args.rounds_per_epoch,
        target_seconds=max(0.0, args.target_hours * 3600.0),
        checkpoint_every_seconds=max(30.0, args.checkpoint_every_minutes * 60.0),
        outdir=outdir,
        resume_checkpoint=args.resume_from,
    )


if __name__ == "__main__":
    main()

