import math
import unittest

from phone_ranging.ranging.drift import estimate_clock_errors, worst_case_drift_error
from phone_ranging.__main__ import finish_round
from phone_ranging.ranging.gaps import (
    cycle_check,
    distances_from_gaps,
    pair_distance,
    pair_timing_offset,
    screen_distances,
    speed_of_sound,
)


class RangingTests(unittest.TestCase):
    def test_gap_formulas_cancel_unknown_times(self):
        c = speed_of_sound(20)
        L = 2.345
        Ti, Tj = 0.512, 0.837
        Si, Sj = 0.003, -0.021
        di, dj = 0.11, 0.14
        fs = 48000
        t_ii = fs * (Ti + di / c - Si)
        t_ij = fs * (Tj + L / c - Si)
        t_jj = fs * (Tj + dj / c - Sj)
        t_ji = fs * (Ti + L / c - Sj)
        gap_ij = (t_ij - t_ii) / fs
        gap_ji = (t_ji - t_jj) / fs
        self.assertAlmostEqual(pair_distance(gap_ij, gap_ji, di, dj, c), L, places=12)
        self.assertAlmostEqual(pair_timing_offset(gap_ij, gap_ji, di, dj, c), Tj - Ti, places=12)

    def test_loop_check_flags_an_echo_by_half_the_delay(self):
        c = 343
        pos = {"A": [0, 0], "B": [2, 0], "C": [1, 1.5]}
        T = {"A": 0.5, "B": 0.8, "C": 1.1}
        ids = list(pos)

        def dist(a, b):
            return math.hypot(pos[a][0] - pos[b][0], pos[a][1] - pos[b][1])

        gaps = {}
        for i in ids:
            gaps[i] = {}
            for j in ids:
                if i != j:
                    gaps[i][j] = {"gap": T[j] - T[i] + dist(i, j) / c}
        ranged = distances_from_gaps(ids, gaps, c=c)
        self.assertEqual(cycle_check(ids, ranged["offsets"])["badCount"], 0)
        for d in ranged["distances"]:
            self.assertAlmostEqual(d["d"], dist(d["a"], d["b"]), places=12)

        delta = 0.002
        gaps["C"]["A"]["gap"] += delta
        ranged = distances_from_gaps(ids, gaps, c=c)
        triangles = cycle_check(ids, ranged["offsets"])["triangles"]
        self.assertAlmostEqual(abs(triangles[0]["closure"]), delta / 2, places=12)
        ac = next(d for d in ranged["distances"] if d["a"] == "A" and d["b"] == "C")
        self.assertAlmostEqual(ac["d"] - dist("A", "C"), (c * delta) / 2, places=12)

    def test_screen_distances_sets_aside_impossible_pairs(self):
        usable, rejected = screen_distances([
            {"a": "A", "b": "B", "d": 1.2},
            {"a": "A", "b": "C", "d": -3.4},
            {"a": "B", "b": "C", "d": 0},
            {"a": "C", "b": "D", "d": 86},
        ])
        self.assertEqual([(m["a"], m["b"]) for m in usable], [("A", "B")])
        self.assertEqual([r["reason"] for r in rejected], ["negative", "negative", "too far"])

    def test_finish_round_still_maps_when_one_pair_is_negative(self):
        pos = {"A": [0, 0], "B": [2, 0], "C": [2, 1.5], "D": [0, 1.5]}
        ids = list(pos)
        gaps = {i: {j: {"gap": math.dist(pos[i], pos[j]) / 343} for j in ids if j != i} for i in ids}
        gaps["A"]["C"]["gap"] = -0.05  # A took the wrong beep as its own
        out = finish_round({"phones": ids, "gaps": gaps, "temperatureC": 20})
        self.assertEqual([(r["a"], r["b"]) for r in out["rejected"]], [("A", "C")])
        self.assertIsNone(out["layoutError"])
        self.assertEqual(out["unplaced"], [])

    def test_clock_drift(self):
        self.assertAlmostEqual(
            worst_case_drift_error(n=5, slot_seconds=0.2, relative_ppm=20, c=343),
            0.002744,
            places=6,
        )
        true_eps = {"A": 0, "B": 12e-6, "C": -7e-6, "D": 3e-6}
        meas = []
        for i in true_eps:
            for j in true_eps:
                if i != j:
                    meas.append({"listener": i, "beeper": j, "r": true_eps[i] - true_eps[j]})
        eps = estimate_clock_errors(list(true_eps), meas, "A")
        for k, v in true_eps.items():
            self.assertAlmostEqual(eps[k], v, places=15)


if __name__ == "__main__":
    unittest.main()
