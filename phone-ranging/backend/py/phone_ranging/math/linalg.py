"""Small linear-algebra helpers the localizer needs.

Matrices are tiny (at most 2n x 2n for n phones), but they are the kind of
thing numpy already does carefully: a solve, a symmetric eigen-decomposition,
and a pseudo-inverse that ignores a known null space.

The layout fit is singular on purpose. Sliding or spinning the whole map
does not change any distance, so JᵀWJ has three zero eigenvalues. A normal
inverse would divide by zero. pseudo_inverse_symmetric drops those directions
and reports uncertainty relative to the group.
"""

import numpy as np


def solve(A, b):
    """Solve A x = b. Raises ValueError if A has no unique solution."""
    A = np.asarray(A, dtype=float)
    b = np.asarray(b, dtype=float)
    try:
        return np.linalg.solve(A, b)
    except np.linalg.LinAlgError as exc:
        raise ValueError("solve(): matrix is singular or nearly singular") from exc


def symmetric_eigen(S):
    """Eigenpairs of a symmetric matrix, largest eigenvalue first.

    vectors[k] is the k-th eigenvector, matching values[k].
    """
    S = np.asarray(S, dtype=float)
    values, vectors = np.linalg.eigh(0.5 * (S + S.T))
    order = np.argsort(values)[::-1]
    values = values[order]
    vectors = vectors[:, order]
    return {
        "values": values,
        "vectors": [vectors[:, k].copy() for k in range(values.shape[0])],
    }


def pseudo_inverse_symmetric(S, rel_tol=1e-9):
    """Moore–Penrose pseudo-inverse via the eigenpairs above the cutoff.

    S⁺ = Σ (1/λ) v vᵀ over eigenvalues that are meaningfully positive.
    Also returns the numerical rank and the eigenvalues (largest first).
    """
    n = len(S)
    eig = symmetric_eigen(S)
    values = eig["values"]
    cutoff = rel_tol * max(abs(float(values[0])), 1e-300)
    P = np.zeros((n, n))
    rank = 0
    for lam, v in zip(values, eig["vectors"]):
        if lam <= cutoff:
            continue
        rank += 1
        P += np.outer(v, v) / lam
    return {"inverse": P, "rank": rank, "values": values}


def symmetric_rank(S, rel_tol=1e-9):
    """How many eigenvalues sit above rel_tol times the largest one."""
    values = symmetric_eigen(S)["values"]
    cutoff = rel_tol * max(abs(float(values[0])), 1e-300)
    return int(np.sum(values > cutoff))
