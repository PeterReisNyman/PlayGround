import os
import shutil
import unittest

from evo_automata.experiments import Sweep, run_sweep


class TestExperiments(unittest.TestCase):
    def setUp(self):
        self.outdir = "runs/test_exp"
        if os.path.exists(self.outdir):
            shutil.rmtree(self.outdir)

    def tearDown(self):
        if os.path.exists(self.outdir):
            shutil.rmtree(self.outdir)

    def test_small_sweep(self):
        sweep = Sweep(
            rules=["B3/S23"],
            widths=[16],
            heights=[8],
            steps=[20],
            densities=[0.2],
            rounds=[2],
            population_sizes=[3],
            mutation_rates=[0.2],
        )
        n = run_sweep(sweep, self.outdir)
        self.assertEqual(n, 1)
        self.assertTrue(os.path.exists(os.path.join(self.outdir, "results.jsonl")))
        self.assertTrue(os.path.exists(os.path.join(self.outdir, "results.csv")))


if __name__ == "__main__":
    unittest.main()

