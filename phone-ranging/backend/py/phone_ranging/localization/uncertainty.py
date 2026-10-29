"""Step 4: how sure we are about each phone.

Near the solution the coordinate covariance is

    Cov(X) ≈ (JᵀWJ)⁺

The pseudo-inverse ignores slide-x, slide-y, and spin, so the ellipses are
"relative to the group": the centroid and the average heading are treated as
fixed. Phone i's 2×2 block is an ellipse. The 95% semi-axes in 2D are
k √λ with k = √(χ²₂ at 95%) = √5.991 ≈ 2.448.

Distances only constrain a phone along the lines to its partners. Phones
nearly in a line get long thin ellipses sideways. That is the picture of a
bad geometry.

(1) assumes the sigmas are right. If S/dof = 4, real errors are about twice
what we claimed, so the covariance is multiplied by max(1, S/dof). It is
never shrunk: with few degrees of freedom, S/dof is too noisy to trust that way.
"""

import math

import numpy as np

from phone_ranging.math.linalg import pseudo_inverse_symmetric

# 95% scale for a 2D ellipse: sqrt(χ²₂ at 0.95)
K95_2D = math.sqrt(5.991)


def position_covariances(JtWJ, variance_factor=1.0):
    inv = pseudo_inverse_symmetric(JtWJ)["inverse"]
    n = inv.shape[0] // 2
    blocks = []
    for i in range(n):
        a = 2 * i
        block = inv[a : a + 2, a : a + 2] * variance_factor
        blocks.append(block)
    return {"blocks": blocks}


def covariance_to_ellipse(S, k=K95_2D):
    """2×2 covariance → 95% ellipse. angle is from +x, counter-clockwise, radians."""
    a, b = float(S[0, 0]), float(S[0, 1])
    c = float(S[1, 1])
    mid = (a + c) / 2
    rad = math.sqrt(((a - c) / 2) ** 2 + b * b)
    l1 = max(mid + rad, 0.0)
    l2 = max(mid - rad, 0.0)
    return {
        "semiMajor": k * math.sqrt(l1),
        "semiMinor": k * math.sqrt(l2),
        "angleRad": 0.5 * math.atan2(2 * b, a - c),
        "sigmaX": math.sqrt(max(a, 0.0)),
        "sigmaY": math.sqrt(max(c, 0.0)),
    }


def transform_covariance(S, R):
    """Σ' = R Σ Rᵀ after the anchor alignment."""
    S = np.asarray(S, dtype=float)
    R = np.asarray(R, dtype=float)
    return R @ S @ R.T
