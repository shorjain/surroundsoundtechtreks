import unittest

import numpy as np

from phone_ranging.math.linalg import pseudo_inverse_symmetric, solve, symmetric_eigen
from tests.rng import Rng


class LinalgTests(unittest.TestCase):
    def test_solve_recovers_x(self):
        A = np.array([[4, 1, 2], [1, 5, 3], [2, 3, 6]], float)
        x = np.array([1, -2, 3], float)
        got = solve(A, A @ x)
        np.testing.assert_allclose(got, x, atol=1e-12)

    def test_symmetric_eigen_rebuilds_and_is_orthonormal(self):
        rng = Rng(7)
        n = 6
        R = np.array([[rng.gaussian() for _ in range(n)] for _ in range(n)])
        S = R @ R.T
        eig = symmetric_eigen(S)
        values, vectors = eig["values"], eig["vectors"]
        for i in range(n):
            for j in range(n):
                rebuilt = sum(float(values[k]) * vectors[k][i] * vectors[k][j] for k in range(n))
                self.assertAlmostEqual(rebuilt, S[i, j], delta=1e-9)
                dot = sum(vectors[i][k] * vectors[j][k] for k in range(n))
                self.assertAlmostEqual(dot, 1.0 if i == j else 0.0, delta=1e-10)
        for k in range(1, n):
            self.assertGreaterEqual(values[k - 1], values[k])

    def test_pseudo_inverse_ignores_null_space(self):
        got = pseudo_inverse_symmetric([[1, 1], [1, 1]])
        self.assertEqual(got["rank"], 1)
        np.testing.assert_allclose(got["inverse"], 0.25, atol=1e-12)

    def test_rng_matches_javascript(self):
        # samples printed from backend/simulate.js makeRng
        rng = Rng(7)
        expected = [
            0.011704753153026104,
            0.06195825757458806,
            0.97690763277933,
            0.6990287057124078,
            0.5214452685322613,
            0.4055216880515218,
        ]
        for value in expected:
            self.assertAlmostEqual(rng.uniform(), value, places=15)
        g = Rng(9)
        gaussians = [1.0676790086483097, 0.8603569306512218, -0.3013236260243831, 1.430084121300899]
        for value in gaussians:
            self.assertAlmostEqual(g.gaussian(), value, places=12)


if __name__ == "__main__":
    unittest.main()
