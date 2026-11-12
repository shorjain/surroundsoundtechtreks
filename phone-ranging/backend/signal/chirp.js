/**
 * chirp.js — the beep every phone plays.
 *
 * A LINEAR CHIRP sweeps its frequency from f0 to f1 over `duration` seconds.
 * Why a chirp and not a plain tone?
 *   - A pure tone looks the same shifted by one cycle, so you can't tell
 *     exactly WHEN it arrived. A sweep never repeats itself, so its
 *     correlation has ONE sharp peak.
 *   - Peak sharpness depends on BANDWIDTH (f1 − f0), not on length. Range
 *     resolution ≈ c / B:  2 kHz → 17 cm,  4 kHz → 8.6 cm. (Precision at good
 *     SNR is much finer than resolution; resolution is how close an echo can
 *     be before it blurs into the direct peak.)
 *   - Length adds ENERGY: a 2× longer chirp gives +3 dB SNR after matched filtering.
 *
 * Phase of a linear chirp (instantaneous frequency f(t) = f0 + k·t, k = (f1−f0)/T):
 *
 *     φ(t) = 2π ( f0·t + ½·k·t² )            (the integral of 2π·f(t))
 *
 * We taper the first/last few ms with a half-cosine ("Tukey window") so the
 * speaker doesn't click. Clicks are broadband and smear the correlation.
 */

/**
 * Value of the chirp at continuous time t (seconds from its start). Zero outside.
 * Being continuous lets the simulator place beeps at fractional-sample delays.
 */
export function chirpAt(t, { f0, f1, duration, taper = 0.1 }) {
  if (t < 0 || t > duration) return 0;
  const k = (f1 - f0) / duration;
  const phase = 2 * Math.PI * (f0 * t + 0.5 * k * t * t);

  // Tukey window: cosine ramps over the first and last (taper/2)·duration.
  const ramp = (taper / 2) * duration;
  let w = 1;
  if (ramp > 0 && t < ramp) w = 0.5 * (1 - Math.cos((Math.PI * t) / ramp));
  else if (ramp > 0 && t > duration - ramp) w = 0.5 * (1 - Math.cos((Math.PI * (duration - t)) / ramp));

  return w * Math.sin(phase);
}

/** Sampled chirp, ready to play or to use as a matched-filter template. */
export function makeChirp({ f0 = 2000, f1 = 6000, duration = 0.01, sampleRate = 48000, taper = 0.1 } = {}) {
  const N = Math.round(duration * sampleRate);
  const out = new Float64Array(N);
  for (let n = 0; n < N; n++) out[n] = chirpAt(n / sampleRate, { f0, f1, duration, taper });
  return out;
}

/** Useful presets for the frequency-band experiment (see docs/TEST_METHODOLOGY.md). */
export const BANDS = {
  '1-3k': { f0: 1000, f1: 3000 },
  '2-6k': { f0: 2000, f1: 6000 }, // default: audible but diffracts around phones well
  '3-6k': { f0: 3000, f1: 6000 },
  '6-10k': { f0: 6000, f1: 10000 },
  '10-14k': { f0: 10000, f1: 14000 },
  '14-17k': { f0: 14000, f1: 17000 },
  '17-21k': { f0: 17000, f1: 21000 }, // near-ultrasonic: quiet to humans, shadows badly
};
