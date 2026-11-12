import math
import unittest

from phone_ranging.localization.align import procrustes_align
from phone_ranging.localization.mds import classical_mds, complete_distance_matrix
from phone_ranging.localization.outliers import chi_square_critical
from phone_ranging.localization.solve import solve_layout
from tests.sim import random_layout, simulate_distances


def ids(n):
    return [chr(65 + k) for k in range(n)]


def solve_and_score(truth, distances, options=None):
    out = solve_layout({"phones": ids(len(truth)), "distances": distances, "options": options or {}})
    est = [[p["x"], p["y"]] for p in out["phones"]]
    fit = procrustes_align(est, truth)
    return out, fit


class LocalizationTests(unittest.TestCase):
    def test_chi_square_matches_tables(self):
        self.assertAlmostEqual(chi_square_critical(1, 0.99), 6.635, delta=0.1)
        self.assertAlmostEqual(chi_square_critical(3, 0.99), 11.345, delta=0.1)
        self.assertAlmostEqual(chi_square_critical(15, 0.99), 30.578, delta=0.2)

    def test_mds_perfect_distances(self):
        truth = random_layout(6, seed=5)
        meas = []
        for i in range(len(truth)):
            for j in range(i + 1, len(truth)):
                d = math.hypot(truth[i][0] - truth[j][0], truth[i][1] - truth[j][1])
                meas.append({"i": i, "j": j, "d": d})
        mds = classical_mds(complete_distance_matrix(len(truth), meas))
        fit = procrustes_align(mds["positions"], truth)
        self.assertLess(fit["rmse"], 1e-9)
        self.assertLess(mds["leftoverRatio"], 1e-9)

    def test_five_phones_centimetre_noise(self):
        truth = random_layout(5, seed=8)
        out, fit = solve_and_score(truth, simulate_distances(truth, sigma=0.02, seed=9))
        self.assertEqual(out["dropped"], [])
        self.assertTrue(out["stats"]["passed"])
        self.assertEqual(out["stats"]["dof"], 3)
        self.assertLess(fit["rmse"], 0.03)

    def test_echo_lock_is_dropped(self):
        truth = random_layout(6, seed=21)
        distances = simulate_distances(truth, sigma=0.01, seed=22, outliers=[{"a": 1, "b": 4, "extra": 0.4}])
        out, fit = solve_and_score(truth, distances)
        self.assertEqual(len(out["dropped"]), 1)
        bad = out["dropped"][0]
        self.assertEqual("".join(sorted([bad["a"], bad["b"]])), "BE")
        self.assertLess(fit["rmse"], 0.02)

    def test_echo_without_rejection_distorts_the_map(self):
        truth = random_layout(6, seed=21)
        distances = simulate_distances(truth, sigma=0.01, seed=22, outliers=[{"a": 1, "b": 4, "extra": 0.4}])
        _out, fit = solve_and_score(truth, distances, {"maxDrops": 0})
        self.assertGreater(fit["rmse"], 0.03)

    def test_missing_pairs_stay_rigid(self):
        truth = random_layout(6, seed=31)
        distances = [
            d for d in simulate_distances(truth, sigma=0.01, seed=32)
            if not (d["a"] == "A" and d["b"] == "F") and not (d["a"] == "C" and d["b"] == "D")
        ]
        out, fit = solve_and_score(truth, distances)
        self.assertEqual(out["stats"]["m"], 13)
        self.assertLess(fit["rmse"], 0.02)

    def test_two_phones_draw_a_line(self):
        out = solve_layout({
            "phones": ["A", "B"],
            "distances": [{"a": "A", "b": "B", "d": 1.5, "sigma": 0.02}],
        })
        A, B = out["phones"]
        self.assertEqual(A["id"], "A")
        self.assertAlmostEqual(A["x"], 0.0)
        self.assertAlmostEqual(A["y"], 0.0)
        self.assertAlmostEqual(B["x"], 1.5)
        self.assertAlmostEqual(B["y"], 0.0)
        self.assertGreater(B["ellipse"]["semiMajor"], 0)
        self.assertTrue(any("two phones" in w.lower() for w in out["warnings"]))

    def test_three_phones_warn_about_redundancy(self):
        truth = [[0, 0], [1, 0], [0.3, 0.8]]
        out, fit = solve_and_score(truth, simulate_distances(truth, sigma=0.001))
        self.assertTrue(any("No redundancy" in w for w in out["warnings"]))
        self.assertLess(fit["rmse"], 0.005)

    def test_collinear_phones_get_thin_ellipses(self):
        truth = [[0, 0], [1, 0.02], [2, -0.02], [3, 0.01], [4, 0]]
        out, _fit = solve_and_score(truth, simulate_distances(truth, sigma=0.01, seed=4))
        mid = out["phones"][2]["ellipse"]
        self.assertGreater(mid["semiMajor"], 5 * mid["semiMinor"])

    def test_anchors(self):
        truth = random_layout(5, seed=40)
        out = solve_layout({
            "distances": simulate_distances(truth, sigma=0.001),
            "options": {"anchors": {"origin": "A", "xAxis": "B", "positiveY": "C"}},
        })
        A, B, C = out["phones"][:3]
        self.assertAlmostEqual(A["x"], 0, places=9)
        self.assertAlmostEqual(A["y"], 0, places=9)
        self.assertAlmostEqual(B["y"], 0, places=9)
        self.assertGreater(B["x"], 0)
        self.assertGreater(C["y"], 0)

    def test_ellipses_cover_about_95_percent(self):
        truth = random_layout(6, seed=50)
        inside = 0
        total = 0
        for trial in range(60):
            out, fit = solve_and_score(truth, simulate_distances(truth, sigma=0.02, seed=1000 + trial))
            for k, p in enumerate(out["phones"]):
                err = math.hypot(fit["positions"][k][0] - truth[k][0], fit["positions"][k][1] - truth[k][1])
                total += 1
                if err <= p["ellipse"]["semiMajor"]:
                    inside += 1
        self.assertGreater(inside / total, 0.85)


if __name__ == "__main__":
    unittest.main()
