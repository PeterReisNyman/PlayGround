import unittest

from evo_automata.automata import Rule, Automaton


class TestRule(unittest.TestCase):
    def test_parse(self):
        r = Rule.parse("B3/S23")
        self.assertEqual(r.birth, frozenset({3}))
        self.assertEqual(r.survive, frozenset({2, 3}))


class TestAutomaton(unittest.TestCase):
    def test_blinker(self):
        r = Rule.parse("B3/S23")
        a = Automaton(5, 5, r, wrap=False)
        # Vertical blinker at center
        a.grid = [[0]*5 for _ in range(5)]
        a.grid[1][2] = 1
        a.grid[2][2] = 1
        a.grid[3][2] = 1
        pop0 = a.population()
        self.assertEqual(pop0, 3)
        a.step()
        # Should be horizontal now
        self.assertEqual(a.population(), 3)
        self.assertEqual(a.grid[2][1:4], [1, 1, 1])
        # And vertical again after another step
        a.step()
        self.assertEqual(a.grid[1][2], 1)
        self.assertEqual(a.grid[2][2], 1)
        self.assertEqual(a.grid[3][2], 1)


if __name__ == "__main__":
    unittest.main()

