Evolving Cellular Automata (Terminal Demo)

What this is
- A small Python module that renders Life-like cellular automata in the terminal.
- It can optionally evolve the rule (B*/S* format) toward more "interesting" dynamics using a simple heuristic.

Quick start
1) Run without evolution (Conway's Life):
   python3 -m evo_automata --rule B3/S23 --width 64 --height 32 --steps 200 --fps 15

2) Run with evolution (searches for a rule before rendering):
   python3 -m evo_automata --evolve --width 64 --height 32 --steps 200 --fps 15 --save-best runs/best_rules.jsonl

Controls
- Ctrl+C to stop the animation.

Project layout
- evo_automata/automata.py: Rule parsing and grid update logic.
- evo_automata/evolver.py: Simple heuristic-based rule evolution.
- evo_automata/renderer.py: Terminal rendering loop.
- evo_automata/__main__.py: CLI entry point.
- evo_automata/experiments.py: Parameter sweeps writing JSONL/CSV.
- tests/test_evo_automata.py: Basic unit tests (run with python3 -m unittest).

Notes
- The heuristic favors sustained, fluctuating populations and penalizes trivial outcomes.
- The terminal renderer clears the screen each frame; reduce fps if it flickers too much.
 - Add --steps 0 to run indefinitely until Ctrl+C.

Experiments
- Example sweep writing to a fresh runs directory:
  python3 -m evo_automata.experiments --rules B3/S23,B36/S23 --widths 48,64 --heights 24,32 --steps 50 --densities 0.2,0.3 --rounds 6 --population-sizes 6 --mutation-rates 0.15,0.25

Long-run evolution (multi-day)
- Checkpointing and resume, intended for 200+ hours:
  python3 -m evo_automata.longrun --rule B3/S23 --width 64 --height 32 --steps-per-eval 60 --population-size 10 --mutation-rate 0.2 --rounds-per-epoch 10 --target-hours 200 --checkpoint-every-minutes 15
  - Output dir defaults to runs/long_<timestamp>, containing checkpoint.json and results.jsonl
  - Use --resume-from runs/long_<timestamp>/checkpoint.json to continue after interruption
