"""Step 1: a first guess from distances alone (classical MDS).

Squared distance expands as

    D_ij² = |p_i|² + |p_j|² − 2 p_i·p_j

Double-centering strips the |p|² terms and leaves the gram matrix B = X Xᵀ.
The top two eigenpairs of B are the coordinates. No starting guess is required,
so refinement cannot get stuck on a bad seed.

MDS cannot tell where the map sits, which way it faces, or whether it is
mirrored. align.py fixes that after the fit.

Missing pairs are filled with shortest paths (Floyd–Warshall). A detour is
never shorter than the straight line, so the fill-in only seeds the solver.
Refinement uses the real measurements only.
"""

import numpy as np

from phone_ranging.math.linalg import symmetric_eigen


def classical_mds(D, dim=2):
    D = np.asarray(D, dtype=float)
    n = D.shape[0]
    D2 = D * D
    row_mean = D2.mean(axis=1)
    grand = float(row_mean.mean())
    B = -0.5 * (D2 - row_mean[:, None] - row_mean[None, :] + grand)

    eig = symmetric_eigen(B)
    values = eig["values"]
    positions = np.zeros((n, dim))
    for k in range(dim):
        positions[:, k] = np.sqrt(max(float(values[k]), 0.0)) * eig["vectors"][k]

    kept = sum(max(float(v), 0.0) for v in values[:dim])
    leftover = sum(abs(float(v)) for v in values[dim:])
    leftover_ratio = leftover / kept if kept > 0 else float("inf")
    return {
        "positions": positions,
        "eigenvalues": values,
        "leftoverRatio": leftover_ratio,
    }


def complete_distance_matrix(n, measurements):
    D = np.full((n, n), np.inf)
    np.fill_diagonal(D, 0.0)
    sums = {}
    for m in measurements:
        i, j = int(m["i"]), int(m["j"])
        key = (i, j) if i < j else (j, i)
        total, count = sums.get(key, (0.0, 0))
        sums[key] = (total + m["d"], count + 1)
    for (i, j), (total, count) in sums.items():
        D[i, j] = D[j, i] = total / count

    for k in range(n):
        via = D[:, k : k + 1] + D[k : k + 1, :]
        D = np.minimum(D, via)

    for i in range(n):
        for j in range(n):
            if not np.isfinite(D[i, j]):
                raise ValueError(
                    f"Phones {i} and {j} are not connected by any chain of measurements; "
                    "the layout cannot be solved as one piece."
                )
    return D
