/**
 * processRound.js — one ping round, from raw recordings to a map.
 *
 *   raw recordings
 *        │  detectRound.js          matched filter → earliest peak → local gaps
 *        ▼
 *   Python phone_ranging
 *        │  ranging/gaps.py         add gaps → distance, subtract → timing
 *        │  localization/solve.py   distances → map + ellipses
 *        ▼
 *   coordinate map + error ellipses + dropped pairs + warnings
 */

import { detectRound } from './detectRound.js';
import { finishRound } from './pybridge.js';

/**
 * @param {object} round
 * @param {{ id: string, slot: number, selfDistance?: number }[]} round.phones
 * @param {Record<string, { samples: Float64Array|number[], sampleRate: number }>} round.recordings
 * @param {object} round.config
 *        { chirp: { f0, f1, duration }, slotSeconds, temperatureC, anchors? }
 */
export function processRound({ phones, recordings, config }) {
  const detected = detectRound({ phones, recordings, config });
  const geo = finishRound({
    phones: detected.ids,
    gaps: detected.gaps,
    selfDistances: detected.selfDistances,
    temperatureC: config.temperatureC ?? 20,
    bandwidthHz: detected.bandwidthHz,
    anchors: config.anchors,
    loopThresholdS: config.loopThresholdS ?? 1e-4,
    maxDistanceM: config.maxDistanceM,
  });
  // Python set aside impossible pairs (≤ 0 or absurdly far). Name the phone
  // whose own-beep check failed, since that is the likely cause.
  const rejected = (geo.rejected || []).map((r) => ({
    ...r,
    suspects: [r.a, r.b].filter((id) => detected.detections[id]?.own.ambiguous || detected.detections[id]?.own.wrongSlot),
  }));
  return {
    speedOfSound: geo.speedOfSound,
    detections: detected.detections,
    gaps: detected.gaps,
    distances: geo.distances,
    rejected,
    unplaced: geo.unplaced || [],
    missing: geo.missing,
    offsets: geo.offsets,
    loops: geo.loops,
    layout: geo.layout,
    layoutError: geo.layoutError,
  };
}
