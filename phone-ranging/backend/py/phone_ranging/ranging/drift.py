"""Phones' clocks do not tick at exactly the same rate.

Phone i's real sample rate is f_s · (1 + ε_i), ε_i ≈ ±20 ppm. A gap counted in
samples and divided by the nominal rate is stretched by (1 + ε_i). The distance
error that survives is

    δD_ij ≈ (c/2) · (ε_i − ε_j) · (T_j − T_i)

Only the relative drift matters, and it grows with the time between the beeps.
Five phones, 200 ms slots, 20 ppm, worst pair 4 slots apart: about 2.7 mm.

A double beep K samples apart on phone j, heard K' samples apart on phone i, gives

    K' / K ≈ 1 + (ε_i − ε_j)
"""

from phone_ranging.math.linalg import solve


def worst_case_drift_error(n, slot_seconds, relative_ppm, c=343):
    gap = (n - 1) * slot_seconds
    return (c / 2) * relative_ppm * 1e-6 * gap


def relative_drift_from_double_beep(K, K_prime):
    return K_prime / K - 1


def estimate_clock_errors(phones, measurements, reference=None):
    """Least squares ε per phone from r_ij ≈ ε_i − ε_j. The reference phone is fixed at 0."""
    if reference is None:
        reference = phones[0]
    unknowns = [p for p in phones if p != reference]
    col = {p: k for k, p in enumerate(unknowns)}
    m = len(unknowns)
    A = [[0.0] * m for _ in range(m)]
    b = [0.0] * m

    for meas in measurements:
        i, j, r = meas["listener"], meas["beeper"], meas["r"]
        row = {}
        if i in col:
            row[col[i]] = 1
        if j in col:
            row[col[j]] = row.get(col[j], 0) - 1
        for a, va in row.items():
            b[a] += va * r
            for bb, vb in row.items():
                A[a][bb] += va * vb

    x = solve(A, b)
    eps = {reference: 0.0}
    for p, k in col.items():
        eps[p] = float(x[k])
    return eps


def correct_gap(gap_seconds, eps_listener):
    return gap_seconds / (1 + eps_listener)
