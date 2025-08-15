import json
import os
import shutil
import unittest

from evo_automata.longrun import run_long
from evo_automata.automata import Rule


class TestLongRun(unittest.TestCase):
    def setUp(self):
        self.outdir = "runs/long_test"
        if os.path.exists(self.outdir):
            shutil.rmtree(self.outdir)

    def tearDown(self):
        if os.path.exists(self.outdir):
            shutil.rmtree(self.outdir)

    def test_checkpoints_written(self):
        # Run for a very short wall-time target to force at least one loop and checkpoint
        rule = Rule.parse("B3/S23")
        run_long(
            base_rule=rule,
            width=24,
            height=12,
            steps_per_eval=10,
            density=0.25,
            population_size=4,
            mutation_rate=0.2,
            rounds_per_epoch=2,
            target_seconds=0.1,  # exit quickly
            checkpoint_every_seconds=0.05,
            outdir=self.outdir,
            resume_checkpoint=None,
        )
        ckpt_path = os.path.join(self.outdir, "checkpoint.json")
        logs_path = os.path.join(self.outdir, "results.jsonl")
        self.assertTrue(os.path.exists(ckpt_path))
        self.assertTrue(os.path.exists(logs_path))
        with open(ckpt_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        self.assertIn("best_score", data)


if __name__ == "__main__":
    unittest.main()

