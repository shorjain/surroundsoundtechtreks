"""Distances in, coordinate map out.

    distances → MDS guess → weighted refine → χ² outlier loop
        → covariance ellipses → align to anchors
"""

import math

import numpy as np

from phone_ranging.localization.align import align_to_anchors
from phone_ranging.localization.mds import classical_mds, complete_distance_matrix
from phone_ranging.localization.outliers import (
    chi_square_critical,
    degrees_of_freedom,
    is_rigid,
    pick_outlier,
)
from phone_ranging.localization.refine import flatten, jacobian, normal_equations, refine_layout, residuals
from phone_ranging.localization.uncertainty import (
    covariance_to_ellipse,
    position_covariances,
    transform_covariance,
)

DEFAULTS = {
    "defaultSigma": 0.05,
    "confidence": 0.99,
    "maxDrops": None,  # none means no cap
    "anchors": None,
}


def two_phone_layout(ids, measurements):
    """Two phones give one distance, so the picture is a line, not a 2D fix.

    The first phone sits at the origin. The second sits to the right, at the
    measured distance. The blob on the second phone is how unsure that
    distance is. A third phone is what turns this into a floor plan.
    """
    if len(measurements) != 1:
        raise ValueError("The two phones did not both hear each other, so there is no distance to draw.")
    m = measurements[0]
    d = m["d"]
    sigma = m["sigma"]
    still = covariance_to_ellipse(np.zeros((2, 2)))
    along = covariance_to_ellipse(np.array([[sigma * sigma, 0.0], [0.0, 0.0]]))
    phones = [
        {"id": ids[0], "x": 0.0, "y": 0.0, "ellipse": still},
        {"id": ids[1], "x": float(d), "y": 0.0, "ellipse": along},
    ]
    pair = {
        "a": ids[m["i"]],
        "b": ids[m["j"]],
        "measured": d,
        "fitted": d,
        "residual": 0.0,
        "normalizedResidual": 0.0,
        "used": True,
    }
    return {
        "phones": phones,
        "pairs": [pair],
        "dropped": [],
        "stats": {
            "n": 2,
            "m": 1,
            "dof": 0,
            "cost": 0.0,
            "chi2Threshold": None,
            "passed": True,
            "varianceFactor": 1.0,
            "mdsLeftoverRatio": 0.0,
            "iterations": 0,
            "rmsResidual": 0.0,
        },
        "warnings": [
            "Only two phones, so this map is the distance between them drawn on a line. Add a third phone for a 2D layout.",
        ],
    }


def solve_layout(body):
    options = body.get("options") or {}
    opts = {**DEFAULTS, **options}
    max_drops = opts["maxDrops"]
    if max_drops is None:
        max_drops = math.inf
    warnings = []

    distances = body.get("distances") or []
    if body.get("phones"):
        ids = list(body["phones"])
    else:
        ids = list(dict.fromkeys(p for m in distances for p in (m["a"], m["b"])))
    index = {pid: k for k, pid in enumerate(ids)}
    n = len(ids)
    if n < 2:
        raise ValueError("Need at least 2 phones to draw a map.")

    measurements = []
    for k, m in enumerate(distances):
        if m["a"] not in index or m["b"] not in index:
            raise ValueError(f"distances[{k}] names an unknown phone")
        if m["a"] == m["b"]:
            raise ValueError(f"distances[{k}] pairs a phone with itself")
        d = m.get("d")
        if not isinstance(d, (int, float)) or not d > 0:
            raise ValueError(f"distances[{k}].d must be a positive number of metres")
        sigma = m.get("sigma")
        if not isinstance(sigma, (int, float)) or not sigma > 0:
            sigma = opts["defaultSigma"]
        measurements.append({
            "i": index[m["a"]],
            "j": index[m["b"]],
            "d": float(d),
            "sigma": float(sigma),
            "w": 1.0 / (float(sigma) * float(sigma)),
        })

    # One distance cannot pin phones down in 2D. Draw the line and say so.
    if n == 2:
        return two_phone_layout(ids, measurements)

    dropped = []
    fit = None
    mds = None
    chi2_threshold = None
    dof = None

    while True:
        Dfull = complete_distance_matrix(n, measurements)
        mds = classical_mds(Dfull, 2)
        fit = refine_layout(mds["positions"], measurements)
        dof = degrees_of_freedom(n, len(measurements))
        chi2_threshold = chi_square_critical(dof, opts["confidence"])
        if fit["cost"] <= chi2_threshold:
            break
        if len(dropped) >= max_drops:
            warnings.append(f"χ² test still failing after {len(dropped)} drops (maxDrops reached).")
            break
        k = pick_outlier(n, fit["positions"], measurements)["index"]
        if k < 0:
            warnings.append("χ² test failed, but no pair can be dropped without making the layout non-rigid.")
            break
        bad = measurements[k]
        dropped.append({
            "a": ids[bad["i"]],
            "b": ids[bad["j"]],
            "measured": bad["d"],
            "normalizedResidual": float(fit["residuals"][k]) / bad["sigma"],
        })
        if dof == 1:
            warnings.append(
                f"Dropped {ids[bad['i']]}–{ids[bad['j']]} with only 1 spare measurement: a fault was detected "
                "but WHICH pair is bad cannot be pinned down reliably. Add a phone for a trustworthy answer."
            )
        measurements = [m for idx, m in enumerate(measurements) if idx != k]

    if dof <= 0:
        warnings.append(
            f"No redundancy (dof = {dof}): every layout fits these distances perfectly, so errors "
            "cannot be detected. Use 4+ phones (5+ to locate a bad pair)."
        )
    if not is_rigid(n, fit["positions"], measurements):
        warnings.append("Layout is not rigid (phones nearly collinear or too few pairs); some positions are ambiguous.")

    X = flatten(fit["positions"])
    r = residuals(X, measurements)
    JtWJ, _g = normal_equations(jacobian(X, measurements), r, measurements)
    variance_factor = max(1.0, fit["cost"] / dof) if dof > 0 else 1.0
    blocks = position_covariances(JtWJ, variance_factor)["blocks"]

    anchor_ids = opts["anchors"] or {"origin": ids[0], "xAxis": ids[1]}
    anchor_idx = {}
    for key in ("origin", "xAxis", "positiveY"):
        if anchor_ids.get(key) is not None:
            anchor_idx[key] = index.get(anchor_ids[key])
    aligned = align_to_anchors(
        fit["positions"],
        origin=0 if anchor_idx.get("origin") is None else anchor_idx["origin"],
        x_axis=1 if anchor_idx.get("xAxis") is None else anchor_idx["xAxis"],
        positive_y=anchor_idx.get("positiveY"),
    )

    rms = math.sqrt(float(np.dot(r, r)) / max(len(r), 1))
    phones = []
    for k, pid in enumerate(ids):
        cov = transform_covariance(blocks[k], aligned["R"])
        phones.append({
            "id": pid,
            "x": float(aligned["positions"][k, 0]),
            "y": float(aligned["positions"][k, 1]),
            "ellipse": covariance_to_ellipse(cov),
        })

    pairs = []
    for m, ri in zip(measurements, r):
        ri = float(ri)
        pairs.append({
            "a": ids[m["i"]],
            "b": ids[m["j"]],
            "measured": m["d"],
            "fitted": m["d"] + ri,
            "residual": ri,
            "normalizedResidual": ri / m["sigma"],
            "used": True,
        })

    return {
        "phones": phones,
        "pairs": pairs,
        "dropped": dropped,
        "stats": {
            "n": n,
            "m": len(measurements),
            "dof": dof,
            "cost": fit["cost"],
            "chi2Threshold": chi2_threshold,
            "passed": fit["cost"] <= chi2_threshold,
            "varianceFactor": variance_factor,
            "mdsLeftoverRatio": mds["leftoverRatio"],
            "iterations": fit["iterations"],
            "rmsResidual": rms,
        },
        "warnings": warnings,
    }
