"""Turn "when did I hear each beep" into a distance and a timing offset.

Arrival model (clock drift ignored, see drift.py):

    t_ij / f_s = T_j + L_ji / c − S_i

The local gap kills the unknown recording start S_i:

    Δ_i(j) = (t_ij − t_ii) / f_s = (T_j − T_i) + (L_ji − d_i) / c

Adding the two directions kills the unknown beep times T:

    D_ij = (c/2) (Δ_i(j) + Δ_j(i)) + (d_i + d_j) / 2

Subtracting them kills the distance and leaves the beep-time offset:

    e_ij = ½ (Δ_i(j) − Δ_j(i)) − (d_j − d_i) / (2c)  ≈  T_j − T_i

Around a triangle these offsets sum to ~0. An echo lock makes the loop miss by δ/2
and the distance long by c·δ/2, before any geometry is attempted.
"""

import math


def speed_of_sound(temp_c=20):
    """Dry air, m/s. 331.3 · √(1 + T/273.15)."""
    return 331.3 * math.sqrt(1 + temp_c / 273.15)


def local_gap(arrival_sample, own_sample, sample_rate):
    return (arrival_sample - own_sample) / sample_rate


def pair_distance(gap_ij, gap_ji, self_i, self_j, c):
    return (c / 2) * (gap_ij + gap_ji) + (self_i + self_j) / 2


def pair_timing_offset(gap_ij, gap_ji, self_i, self_j, c):
    """Estimated T_j − T_i in seconds. Antisymmetric: e_ji = −e_ij."""
    return 0.5 * (gap_ij - gap_ji) - (self_j - self_i) / (2 * c)


def timing_sigma(snr_db, bandwidth_hz):
    """1-σ timing jitter of a matched-filter peak, seconds.

    σ_t ≈ 1 / (2π · β · ρ), β = B/√12 for a flat chirp, ρ = 10^(SNR/20).
    """
    beta = bandwidth_hz / math.sqrt(12)
    rho = 10 ** (snr_db / 20)
    return 1 / (2 * math.pi * beta * rho)


def distance_sigma(snr_ij, snr_ji, bandwidth_hz, c, floor_m=0.01):
    """1-σ distance uncertainty from the two cross-detection SNRs, with a floor."""
    s_ij = timing_sigma(snr_ij, bandwidth_hz)
    s_ji = timing_sigma(snr_ji, bandwidth_hz)
    from_noise = (c / 2) * math.sqrt(s_ij * s_ij + s_ji * s_ji)
    return math.sqrt(from_noise * from_noise + floor_m * floor_m)


def _finite(x):
    try:
        return math.isfinite(float(x))
    except (TypeError, ValueError):
        return False


def distances_from_gaps(phones, gaps, self_distances=None, c=343.0, bandwidth_hz=None, default_sigma=0.03):
    self_distances = self_distances or {}
    distances = []
    offsets = {p: {} for p in phones}
    missing = []
    gaps = gaps or {}

    for x, i in enumerate(phones):
        for j in phones[x + 1 :]:
            gij = (gaps.get(i) or {}).get(j)
            gji = (gaps.get(j) or {}).get(i)
            if not gij or not gji or not _finite(gij.get("gap")) or not _finite(gji.get("gap")):
                missing.append(f"{i}–{j}")
                continue
            di = self_distances.get(i, 0) or 0
            dj = self_distances.get(j, 0) or 0
            d = pair_distance(gij["gap"], gji["gap"], di, dj, c)
            if bandwidth_hz and _finite(gij.get("snrDb")) and _finite(gji.get("snrDb")):
                sigma = distance_sigma(gij["snrDb"], gji["snrDb"], bandwidth_hz, c)
            else:
                sigma = default_sigma
            distances.append({"a": i, "b": j, "d": d, "sigma": sigma})
            e = pair_timing_offset(gij["gap"], gji["gap"], di, dj, c)
            offsets[i][j] = e
            offsets[j][i] = -e
    return {"distances": distances, "offsets": offsets, "missing": missing}


def screen_distances(distances, max_distance_m=30.0):
    """Split pair distances into (usable, rejected).

    d ≤ 0 is impossible (a beep heard before it was sent) and d > max_distance_m
    is far beyond any room. Both mean a detection went badly wrong, most likely
    the own beep (see detectArrivals.js). Rejected pairs are reported, never
    silently dropped.
    """
    usable = []
    rejected = []
    for m in distances:
        d = m["d"]
        if not d > 0:
            rejected.append({"a": m["a"], "b": m["b"], "d": d, "reason": "negative"})
        elif d > max_distance_m:
            rejected.append({"a": m["a"], "b": m["b"], "d": d, "reason": "too far"})
        else:
            usable.append(m)
    return usable, rejected


def cycle_check(phones, offsets, threshold=1e-4):
    """Loop sum e_ab + e_bc + e_ca on every triangle. threshold is in seconds."""
    triangles = []
    suspicion = {}

    def bump(a, b):
        key = f"{a}–{b}" if a < b else f"{b}–{a}"
        suspicion[key] = suspicion.get(key, 0) + 1

    for x, a in enumerate(phones):
        for y in range(x + 1, len(phones)):
            b = phones[y]
            for z in range(y + 1, len(phones)):
                k = phones[z]
                eab = (offsets.get(a) or {}).get(b)
                ebk = (offsets.get(b) or {}).get(k)
                eka = (offsets.get(k) or {}).get(a)
                if not all(_finite(v) for v in (eab, ebk, eka)):
                    continue
                closure = eab + ebk + eka
                ok = abs(closure) <= threshold
                triangles.append({"phones": [a, b, k], "closure": closure, "ok": ok})
                if not ok:
                    bump(a, b)
                    bump(b, k)
                    bump(k, a)
    return {
        "triangles": triangles,
        "suspicion": suspicion,
        "badCount": sum(1 for t in triangles if not t["ok"]),
    }
