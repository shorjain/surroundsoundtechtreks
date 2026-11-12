"""JSON line protocol used by the Node server.

One JSON object per line on stdin, one JSON object per line on stdout:
    {"op": "solve_layout"|"finish_round"|"procrustes", ...}
    {"ok": true, "result": ...}   or   {"ok": false, "error": "..."}
"""

import json
import math
import sys

import numpy as np

from phone_ranging.localization.align import procrustes_align
from phone_ranging.localization.solve import solve_layout
from phone_ranging.ranging.gaps import cycle_check, distances_from_gaps, screen_distances, speed_of_sound


def finish_round(body):
    phones = list(body["phones"])
    c = speed_of_sound(body.get("temperatureC", 20))
    ranged = distances_from_gaps(
        phones,
        body.get("gaps") or {},
        body.get("selfDistances") or {},
        c,
        body.get("bandwidthHz"),
        body.get("defaultSigma", 0.03),
    )
    loops = cycle_check(phones, ranged["offsets"], body.get("loopThresholdS", 1e-4))

    # One impossible pair used to make the solver throw and lose the whole map.
    # Set those pairs aside, and place only phones that still have a usable pair.
    max_distance = body.get("maxDistanceM")
    usable, rejected = screen_distances(ranged["distances"], 30.0 if max_distance is None else max_distance)
    placeable = [p for p in phones if any(p in (d["a"], d["b"]) for d in usable)]
    unplaced = [p for p in phones if p not in placeable]

    layout = None
    layout_error = None
    try:
        layout = solve_layout({
            "phones": placeable,
            "distances": usable,
            "options": {"anchors": body.get("anchors")},
        })
    except Exception as exc:  # same as processRound: a bad geometry is a result, not a crash
        layout_error = str(exc)
    return {
        "speedOfSound": c,
        "distances": ranged["distances"],
        "rejected": rejected,
        "unplaced": unplaced,
        "missing": ranged["missing"],
        "offsets": ranged["offsets"],
        "loops": loops,
        "layout": layout,
        "layoutError": layout_error,
    }


def _procrustes(body):
    fit = procrustes_align(body["estimate"], body["truth"])
    return {
        "positions": fit["positions"],
        "rmse": fit["rmse"],
        "errors": fit["errors"],
        "reflected": fit["reflected"],
    }


def sanitize(value):
    """Plain JSON: numpy scalars become floats, inf/nan become null (JSON has no Infinity)."""
    if isinstance(value, dict):
        return {str(k): sanitize(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize(v) for v in value]
    if isinstance(value, np.ndarray):
        return sanitize(value.tolist())
    if isinstance(value, np.floating):
        value = float(value)
    elif isinstance(value, np.integer):
        return int(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (str, int, bool)) or value is None:
        return value
    return value


_OPS = {
    "solve_layout": solve_layout,
    "finish_round": finish_round,
    "procrustes": _procrustes,
    "ping": lambda _body: {"pong": True},
}


def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            op = req.pop("op")
            fn = _OPS.get(op)
            if fn is None:
                raise ValueError(f"unknown op {op}")
            out = {"ok": True, "result": sanitize(fn(req))}
        except Exception as exc:
            out = {"ok": False, "error": str(exc)}
        sys.stdout.write(json.dumps(out) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
