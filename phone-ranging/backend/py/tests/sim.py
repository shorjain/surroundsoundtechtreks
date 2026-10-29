"""Seeded layouts, same algorithm as backend/simulate.js."""

import math

from tests.rng import Rng


def random_layout(n, width=4, height=3, min_gap=0.4, seed=1):
    rng = Rng(seed)
    pts = []
    while len(pts) < n:
        p = [rng.uniform() * width, rng.uniform() * height]
        if all(math.hypot(p[0] - q[0], p[1] - q[1]) >= min_gap for q in pts):
            pts.append(p)
    return pts


def simulate_distances(positions, sigma=0.02, seed=2, outliers=None, ids=None):
    rng = Rng(seed)
    outliers = outliers or []

    def name(k):
        return ids[k] if ids else chr(65 + k)

    out = []
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            truth = math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1])
            d = truth + sigma * rng.gaussian()
            for o in outliers:
                if (o["a"] == i and o["b"] == j) or (o["a"] == j and o["b"] == i):
                    d += o["extra"]
            out.append({"a": name(i), "b": name(j), "d": d, "sigma": sigma, "truth": truth})
    return out
