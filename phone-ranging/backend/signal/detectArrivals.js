/**
 * detectArrivals.js — read arrival times off the matched-filter envelope.
 *
 * THE ECHO PROBLEM
 *   The tallest peak is not always the direct sound. If the phones face away
 *   from each other, the direct path is shadowed by the phone body and a wall
 *   reflection can be LOUDER. But a reflection always travels further, so it
 *   always arrives LATER. Rule:
 *
 *       take the EARLIEST peak that is clearly above the noise,
 *       not the STRONGEST peak.
 *
 *   "Clearly above" = above BOTH
 *     (a) noise floor × (min SNR)          — not just noise
 *     (b) relativeThreshold × strongest    — not a tiny sidelobe/pre-ringing
 *
 * SUB-SAMPLE PRECISION
 *   One sample at 48 kHz = 20.8 µs = 7.1 mm of sound travel. Fitting a parabola
 *   through the peak sample and its two neighbours finds the true top between
 *   samples:
 *         offset = ½ · (y₋ − y₊) / (y₋ − 2y₀ + y₊)        (in samples, −0.5…+0.5)
 *
 * SCHEDULE
 *   Each phone beeps in its own slot (slot k at k·slotSeconds after the round
 *   starts). A phone first finds its OWN beep — by far the loudest thing it
 *   hears, its speaker is centimetres from its mic. Every other phone's beep
 *   is then searched for in a window around  own + (slot_j − slot_i)·slotSeconds.
 *   The window must cover how far the two phones' ideas of "round start" can
 *   disagree: network clock-sync error (± tens of ms over a tunnel) plus speaker
 *   output latency, which differs between phones by up to ~150 ms on Android.
 *   Add travel time (~3 ms per metre). Hence −150 / +200 ms, which is why slots
 *   are 0.5 s apart: a window must never reach a neighbouring slot's beep.
 *
 * OWN-BEEP DIAGNOSTICS
 *   Everything hangs on step 1. If another beep (or a clap) is louder than the
 *   own beep — own beep routed to a quiet earpiece, a loud laptop nearby — the
 *   wrong beep becomes "own", every window lands on a neighbouring slot, and the
 *   gaps pick up the beep-timing slop of the wrong phones (tens of ms → metres,
 *   either sign → negative distances). Two independent checks, reported only
 *   (detection itself is unchanged):
 *     marginDb        own peak vs the strongest peak elsewhere in the recording.
 *                     Small (< 6 dB) → the choice was a near coin-flip.
 *     scheduleOffsetS where the own beep was found vs where the phone scheduled
 *                     it (expectedOwnIndex, sent by the phone). Normal: a few
 *                     tens of ms of speaker+mic latency. About ±slotSeconds →
 *                     a different slot's beep was picked.
 */

import { matchedFilter } from './matchedFilter.js';

/** Median — a robust noise-floor estimate (beeps are a small part of a recording). */
export function median(values) {
  const a = Float64Array.from(values).sort();
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : 0.5 * (a[m - 1] + a[m]);
}

/** Parabolic interpolation around integer peak p. Returns fractional index. */
export function refinePeak(y, p) {
  if (p <= 0 || p >= y.length - 1) return p;
  const a = y[p - 1];
  const b = y[p];
  const c = y[p + 1];
  const denom = a - 2 * b + c;
  if (denom === 0) return p;
  return p + (0.5 * (a - c)) / denom;
}

/**
 * Earliest significant peak in envelope[start, end).
 * @returns {null | { index, peak, snrDb, strongestIndex, isStrongest }}
 */
export function findEarliestPeak(
  envelope,
  { start = 0, end = envelope.length, noise, minSnrDb = 12, relativeThreshold = 0.35 },
) {
  start = Math.max(0, Math.floor(start));
  end = Math.min(envelope.length, Math.ceil(end));
  if (end <= start) return null;

  // Strongest point in the window.
  let strongest = start;
  for (let k = start; k < end; k++) if (envelope[k] > envelope[strongest]) strongest = k;
  const M = envelope[strongest];

  const snrFloor = noise * 10 ** (minSnrDb / 20);
  if (M < snrFloor) return null; // nothing but noise here

  const threshold = Math.max(snrFloor, relativeThreshold * M);

  // First crossing, then climb to the top of that hump.
  let k = start;
  while (k < end && envelope[k] < threshold) k++;
  while (k + 1 < end && envelope[k + 1] >= envelope[k]) k++;

  return {
    index: refinePeak(envelope, k),
    peak: envelope[k],
    snrDb: 20 * Math.log10(envelope[k] / noise),
    strongestIndex: strongest,
    isStrongest: k === strongest, // false → an earlier, weaker peak was chosen over a (likely) echo
  };
}

/**
 * Full per-phone processing: one recording in, arrival of every beep out.
 *
 * @param {object} p
 * @param {Float64Array|number[]} p.samples       phone i's recording
 * @param {number} p.sampleRate
 * @param {Float64Array} p.template               the chirp (makeChirp)
 * @param {string} p.self                         this phone's id
 * @param {Record<string, number>} p.slots        phoneId → slot number
 * @param {number} p.slotSeconds
 * @param {number} [p.searchBeforeS]              window before expected time
 * @param {number} [p.searchAfterS]               window after (covers travel time)
 * @param {number} [p.expectedOwnIndex]           sample where the phone scheduled its own beep (diagnostic only)
 * @param {number} [p.minOwnMarginDb]             own beep must beat the runner-up by this much, else "ambiguous"
 * @returns {{ own: object, arrivals: Record<string, object|null>, gaps: Record<string, {gap, snrDb, isStrongest}> }}
 */
export function detectArrivals({
  samples,
  sampleRate,
  template,
  self,
  slots,
  slotSeconds,
  searchBeforeS = 0.15,
  searchAfterS = 0.2,
  minSnrDb = 12,
  relativeThreshold = 0.35,
  expectedOwnIndex,
  minOwnMarginDb = 6,
}) {
  const { envelope } = matchedFilter(samples, template);
  const noise = median(envelope);

  // 1. Own beep: the global maximum.
  let ownIdx = 0;
  for (let k = 1; k < envelope.length; k++) if (envelope[k] > envelope[ownIdx]) ownIdx = k;
  const own = {
    index: refinePeak(envelope, ownIdx),
    peak: envelope[ownIdx],
    snrDb: 20 * Math.log10(envelope[ownIdx] / noise),
  };

  // 1b. How sure are we that this was really our own beep?
  //     Runner-up = strongest point outside a guard zone around the own beep
  //     (the guard skips the own beep's echoes and sidelobes).
  const guard = Math.round(Math.min(0.1, slotSeconds / 2) * sampleRate);
  let runnerIdx = -1;
  for (let k = 0; k < envelope.length; k++) {
    if (Math.abs(k - ownIdx) <= guard) continue;
    if (runnerIdx < 0 || envelope[k] > envelope[runnerIdx]) runnerIdx = k;
  }
  own.marginDb = runnerIdx >= 0 ? 20 * Math.log10(envelope[ownIdx] / envelope[runnerIdx]) : Infinity;
  own.runnerUp = runnerIdx >= 0
    ? { offsetS: (runnerIdx - ownIdx) / sampleRate, snrDb: 20 * Math.log10(envelope[runnerIdx] / noise) }
    : null;
  own.ambiguous = own.marginDb < minOwnMarginDb;
  if (Number.isFinite(expectedOwnIndex)) {
    own.scheduleOffsetS = (own.index - expectedOwnIndex) / sampleRate;
    own.wrongSlot = Math.abs(own.scheduleOffsetS) > slotSeconds / 2;
  }

  // 2. Everyone else, in their expected windows.
  const arrivals = {};
  const gaps = {};
  for (const [other, slot] of Object.entries(slots)) {
    if (other === self) continue;
    const expected = own.index + (slot - slots[self]) * slotSeconds * sampleRate;
    const hit = findEarliestPeak(envelope, {
      start: expected - searchBeforeS * sampleRate,
      end: expected + searchAfterS * sampleRate,
      noise,
      minSnrDb,
      relativeThreshold,
    });
    arrivals[other] = hit;
    if (hit) {
      gaps[other] = {
        gap: (hit.index - own.index) / sampleRate, // Δ_self(other), gaps.py eq. (2)
        snrDb: hit.snrDb,
        isStrongest: hit.isStrongest,
      };
    }
  }
  return { own, arrivals, gaps, noise };
}
