/**
 * matchedFilter.js — "where in this recording does the chirp appear?"
 *
 * CROSS-CORRELATION slides the known chirp h along the recording x and, at
 * every offset (lag), measures how well they line up:
 *
 *     corr[lag] = Σ_t  x[t + lag] · h[t]
 *
 * Where the chirp arrived, every term adds constructively → a tall peak. Noise
 * adds randomly → small values. This is the optimal detector for a known
 * signal in white noise ("matched filter").
 *
 * FAST VERSION: correlation in time = multiplication in frequency:
 *
 *     corr = IFFT( FFT(x) · conj(FFT(h)) )
 *
 * (Zero-pad both to ≥ len(x) + len(h) so the circular FFT doesn't wrap around.)
 *
 * ENVELOPE: corr itself wiggles at the chirp's carrier frequency (~4 kHz),
 * so its tallest wiggle can be off by a fraction of a cycle and jump between
 * neighbouring wiggles under noise. We take the smooth ENVELOPE instead — the
 * magnitude of the "analytic signal", built by deleting negative frequencies
 * and doubling positive ones before the inverse FFT. It peaks exactly where
 * the chirp starts and has no wiggles to confuse the peak picker.
 */

import { fft, nextPow2 } from './fft.js';

/**
 * @param {Float64Array|number[]} recording
 * @param {Float64Array|number[]} template   e.g. makeChirp(...)
 * @returns {{ envelope: Float64Array, correlation: Float64Array }}
 *          both length = recording.length; index = sample where the chirp starts
 */
export function matchedFilter(recording, template) {
  const N = nextPow2(recording.length + template.length);

  // FFT of the recording (zero-padded).
  const xr = new Float64Array(N);
  const xi = new Float64Array(N);
  xr.set(recording);
  fft(xr, xi);

  // FFT of the template (zero-padded).
  const hr = new Float64Array(N);
  const hi = new Float64Array(N);
  hr.set(template);
  fft(hr, hi);

  // Multiply X by conj(H), and at the same time build the analytic signal:
  // bin 0 and bin N/2 kept as-is, bins 1..N/2−1 doubled, bins N/2+1..N−1 zeroed.
  const pr = new Float64Array(N);
  const pi = new Float64Array(N);
  for (let k = 0; k <= N / 2; k++) {
    // (a + ib)(c − id) = (ac + bd) + i(bc − ad)
    const re = xr[k] * hr[k] + xi[k] * hi[k];
    const im = xi[k] * hr[k] - xr[k] * hi[k];
    const scale = k === 0 || k === N / 2 ? 1 : 2;
    pr[k] = scale * re;
    pi[k] = scale * im;
  }
  fft(pr, pi, true);

  // Normalise by template energy so values are comparable across chirps.
  let energy = 0;
  for (let t = 0; t < template.length; t++) energy += template[t] * template[t];

  const L = recording.length;
  const envelope = new Float64Array(L);
  const correlation = new Float64Array(L);
  for (let lag = 0; lag < L; lag++) {
    correlation[lag] = pr[lag] / energy; // real part = ordinary correlation
    envelope[lag] = Math.hypot(pr[lag], pi[lag]) / energy;
  }
  return { envelope, correlation };
}
