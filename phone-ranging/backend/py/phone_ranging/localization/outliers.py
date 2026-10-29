"""Step 3: catch and drop bad distances.

If every sigma is honest and the errors are Gaussian, the fitted cost

    S = Σ (r_ij / σ_ij)²

follows χ² with dof = m − (2n − 3). That is the redundancy: measurements
beyond the 2n − 3 numbers a 2D layout actually has (2 per phone, minus slide
and spin). S above the 99th percentile means something is wrong. With dof = 0
(3 phones) the fit is always perfect and geometry cannot see an echo.

Dropping the pair with the largest residual fails on a big echo: the bad pair
drags a phone, and the phone's good pairs then look worse ("masking"). Instead
each candidate is removed, the layout is re-solved, and the pair whose removal
makes the rest agree best is dropped. A pair is kept if removing it would make
the layout floppy.

A layout is rigid when rank(JᵀJ) = 2n − 3 and every phone still has at least
two partners. 2n coordinates minus 3 harmless whole-map motions.
"""

import math

import numpy as np

from phone_ranging.localization.mds import classical_mds, complete_distance_matrix
from phone_ranging.localization.refine import flatten, jacobian, refine_layout
from phone_ranging.math.linalg import symmetric_rank

# upper-tail standard-normal quantiles, for the wilson–hilferty approximation
_Z = {0.95: 1.6449, 0.99: 2.3263, 0.999: 3.0902}


def chi_square_critical(dof, p=0.99):
    """χ²(dof) value that S exceeds with probability (1 − p) when nothing is wrong.

    Wilson–Hilferty: (χ²/k)^(1/3) is nearly normal. Good to about 1% for k ≥ 1,
    which is tighter than our sigmas.
    """
    if dof <= 0:
        return math.inf
    z = _Z.get(p)
    if z is None:
        for key, val in _Z.items():
            if abs(key - float(p)) < 1e-9:
                z = val
                break
    if z is None:
        raise ValueError(f"chiSquareCritical: unsupported p={p}")
    a = 2 / (9 * dof)
    return dof * (1 - a + z * math.sqrt(a)) ** 3


def degrees_of_freedom(n, m):
    return m - (2 * n - 3)


def is_rigid(n, positions, measurements):
    if n <= 1:
        return True
    degree = [0] * n
    for m in measurements:
        degree[m["i"]] += 1
        degree[m["j"]] += 1
    min_degree = 1 if n == 2 else 2
    if any(d < min_degree for d in degree):
        return False

    J = jacobian(flatten(positions), measurements)
    cols = 2 * n
    JtJ = np.zeros((cols, cols))
    for row in J:
        nz = np.flatnonzero(row)
        if nz.size == 0:
            continue
        JtJ[np.ix_(nz, nz)] += np.outer(row[nz], row[nz])
    return symmetric_rank(JtJ, 1e-8) == 2 * n - 3


def pick_outlier(n, positions, measurements):
    """Pair whose removal gives the lowest re-fitted cost, among rigid removals.

    index is −1 when nothing can be dropped.
    """
    best = {"index": -1, "costAfter": math.inf}
    for k in range(len(measurements)):
        remaining = [m for idx, m in enumerate(measurements) if idx != k]
        if not is_rigid(n, positions, remaining):
            continue
        start = classical_mds(complete_distance_matrix(n, remaining))["positions"]
        cost = refine_layout(start, remaining)["cost"]
        if cost < best["costAfter"]:
            best = {"index": k, "costAfter": cost}
    return best
