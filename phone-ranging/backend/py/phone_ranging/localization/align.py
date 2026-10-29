"""Step 5: put the map somewhere and face it somewhere.

Distances are unchanged by a slide, a spin, or a mirror. Two tools:

  align_to_anchors — phone A at the origin, phone B on +x, phone C on the +y side.
  procrustes_align — for tests and the host page: overlay one point set on another
                     so the only thing left is the real position error.
"""

import math

import numpy as np


def align_to_anchors(positions, origin=0, x_axis=1, positive_y=None):
    P = np.asarray(positions, dtype=float)
    shifted = P - P[origin]
    ax, ay = shifted[x_axis]
    phi = math.atan2(ay, ax)
    c, s = math.cos(-phi), math.sin(-phi)
    R = np.array([[c, -s], [s, c]])
    out = shifted @ R.T
    if positive_y is not None and out[positive_y, 1] < 0:
        out = out.copy()
        out[:, 1] *= -1
        R = np.vstack([R[0], -R[1]])
    return {"positions": out, "R": R}


def procrustes_align(estimate, truth):
    """Best overlay of estimate onto truth, trying a mirror and keeping the closer one."""
    truth = np.asarray(truth, dtype=float)
    estimate = np.asarray(estimate, dtype=float)

    def centre(P):
        c = P.mean(axis=0)
        return c, P - c

    tc, T = centre(truth)

    def try_fit(E0, reflected):
        _ec, E = centre(np.asarray(E0, dtype=float))
        cross = 0.0
        dot_sum = 0.0
        for (ex, ey), (tx, ty) in zip(E, T):
            cross += ex * ty - ey * tx
            dot_sum += ex * tx + ey * ty
        th = math.atan2(cross, dot_sum)
        c, s = math.cos(th), math.sin(th)
        R = np.array([[c, -s], [s, c]])
        positions = E @ R.T + tc
        errors = np.hypot(positions[:, 0] - truth[:, 0], positions[:, 1] - truth[:, 1])
        rmse = float(np.sqrt(np.mean(errors ** 2)))
        return {"positions": positions, "rmse": rmse, "errors": errors, "reflected": reflected}

    plain = try_fit(estimate, False)
    mirrored = try_fit(estimate * np.array([1.0, -1.0]), True)
    return mirrored if mirrored["rmse"] < plain["rmse"] else plain
