/**
 * detectRound.js — matched filter → earliest peak → local gaps.
 *
 * This half of a round stays in JavaScript: the phone page and the lab run
 * the same chirp code. Distances and the map are finished in Python
 * (pybridge.js → phone_ranging).
 */

import { makeChirp } from './signal/chirp.js';
import { detectArrivals } from './signal/detectArrivals.js';

/**
 * @param {object} round
 * @param {{ id: string, slot: number, selfDistance?: number }[]} round.phones
 * @param {Record<string, { samples: Float64Array|number[], sampleRate: number }>} round.recordings
 * @param {object} round.config  { chirp: { f0, f1, duration }, slotSeconds }
 */
export function detectRound({ phones, recordings, config }) {
  const ids = phones.map((p) => p.id);
  const slots = Object.fromEntries(phones.map((p) => [p.id, p.slot]));
  const selfDistances = Object.fromEntries(phones.map((p) => [p.id, p.selfDistance ?? 0]));
  const { f0, f1, duration } = config.chirp;

  const detections = {};
  const gaps = {};
  for (const id of ids) {
    const rec = recordings[id];
    if (!rec) throw new Error(`No recording uploaded for phone ${id}`);
    const template = makeChirp({ f0, f1, duration, sampleRate: rec.sampleRate });
    const det = detectArrivals({
      samples: rec.samples,
      sampleRate: rec.sampleRate,
      template,
      self: id,
      slots,
      slotSeconds: config.slotSeconds,
      expectedOwnIndex: rec.meta?.expectedOwnIndex,
    });
    let maxAbs = 0;
    for (const v of rec.samples) maxAbs = Math.max(maxAbs, Math.abs(v));
    detections[id] = {
      ownSnrDb: det.own.snrDb,
      noiseFloor: det.noise,
      maxAbsSample: maxAbs,

      // Was the "own beep" really ours? See detectArrivals.js, OWN-BEEP DIAGNOSTICS.
      own: {
        marginDb: det.own.marginDb,
        runnerUp: det.own.runnerUp,
        ambiguous: det.own.ambiguous,
        scheduleOffsetS: det.own.scheduleOffsetS ?? null, // null: phone sent no schedule info
        wrongSlot: det.own.wrongSlot ?? null,
      },
      droppedBlocks: rec.meta?.droppedBlocks ?? null, // gaps in the phone's mic stream
      micSettings: rec.meta?.micSettings ?? null, // processing the browser actually applied
      roundsTaken: rec.meta?.roundsTaken ?? null,
      heard: Object.fromEntries(
        Object.entries(det.arrivals).map(([other, a]) => [
          other,
          a ? { snrDb: a.snrDb, earliestWasStrongest: a.isStrongest } : null,
        ]),
      ),
    };
    gaps[id] = det.gaps;
  }

  return { ids, selfDistances, detections, gaps, bandwidthHz: Math.abs(f1 - f0) };
}
