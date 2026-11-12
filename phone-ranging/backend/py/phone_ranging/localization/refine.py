"""Step 2: polish the MDS guess on the real (unsquared) distances.

MDS fits squared distances, so a 1 cm error on a long pair outweighs the same
error on a short pair, and it cannot use a per-pair sigma. Here we minimise

    S(X) = Σ w_ij ( |p_i − p_j| − D_ij )² ,   w_ij = 1/σ_ij²

by Levenberg–Marquardt. The Jacobian of one residual is the unit vector along
that pair: motion along the line changes the distance 1-for-1, motion sideways
changes it about 0.

JᵀWJ is singular because a slide or a spin changes no distance. Adding λI
makes the step unique and, when λ is large, shrinks it toward gradient descent.
A step that lowers S is kept and λ shrinks; a step that raises S is rejected
and λ grows.

Positions are stored flat: X = [x0, y0, x1, y1, ...].
"""

import math

import numpy as np

from phone_ranging.math.linalg import solve


def flatten(positions):
    P = np.asarray(positions, dtype=float)
    return P.reshape(-1).copy()


def unflatten(X):
    X = np.asarray(X, dtype=float)
    return X.reshape(-1, 2)


def residuals(X, measurements):
    X = np.asarray(X, dtype=float)
    out = np.empty(len(measurements))
    for k, m in enumerate(measurements):
        i, j = m["i"], m["j"]
        dx = X[2 * i] - X[2 * j]
        dy = X[2 * i + 1] - X[2 * j + 1]
        out[k] = math.hypot(dx, dy) - m["d"]
    return out


def jacobian(X, measurements):
    X = np.asarray(X, dtype=float)
    J = np.zeros((len(measurements), X.shape[0]))
    for row, m in enumerate(measurements):
        i, j = m["i"], m["j"]
        dx = X[2 * i] - X[2 * j]
        dy = X[2 * i + 1] - X[2 * j + 1]
        length = max(math.hypot(dx, dy), 1e-9)
        ux, uy = dx / length, dy / length
        J[row, 2 * i] = ux
        J[row, 2 * i + 1] = uy
        J[row, 2 * j] = -ux
        J[row, 2 * j + 1] = -uy
    return J


def weighted_cost(r, measurements):
    return float(sum(m["w"] * ri * ri for m, ri in zip(measurements, r)))


def normal_equations(J, r, measurements):
    """JᵀWJ and JᵀWr. W is diagonal, so it is never formed."""
    cols = J.shape[1]
    A = np.zeros((cols, cols))
    g = np.zeros(cols)
    for k, m in enumerate(measurements):
        w = m["w"]
        row = J[k]
        nz = np.flatnonzero(row)
        g[nz] += w * row[nz] * r[k]
        A[np.ix_(nz, nz)] += w * np.outer(row[nz], row[nz])
    return A, g


def refine_layout(initial_positions, measurements, max_iterations=200, step_tolerance=1e-10, initial_lambda=1e-3):
    X = flatten(initial_positions)
    r = residuals(X, measurements)
    cost = weighted_cost(r, measurements)
    lam = None
    converged = False
    it = 0

    for it in range(max_iterations):
        J = jacobian(X, measurements)
        A, g = normal_equations(J, r, measurements)
        if lam is None:
            mean_diag = float(np.trace(A)) / A.shape[0]
            lam = initial_lambda * max(mean_diag, 1e-12)

        accepted = False
        for _attempt in range(30):
            damped = A.copy()
            damped.flat[:: A.shape[0] + 1] += lam
            try:
                delta = solve(damped, -g)
            except ValueError:
                # λ still too small for the gauge null-space; damp and try again
                lam *= 10
                continue
            X_new = X + delta
            r_new = residuals(X_new, measurements)
            cost_new = weighted_cost(r_new, measurements)
            if cost_new <= cost:
                step = float(np.linalg.norm(delta))
                improvement = cost - cost_new
                X, r, cost = X_new, r_new, cost_new
                lam /= 10
                accepted = True
                if step < step_tolerance or improvement <= 1e-15 * max(cost, 1e-30):
                    converged = True
                break
            lam *= 10
        if not accepted or converged:
            converged = True
            break

    n = X.shape[0] // 2
    cx = float(X[0::2].sum()) / n
    cy = float(X[1::2].sum()) / n
    X = X.copy()
    X[0::2] -= cx
    X[1::2] -= cy

    return {
        "positions": unflatten(X),
        "cost": cost,
        "iterations": it + 1,
        "residuals": r,
        "converged": converged,
    }
