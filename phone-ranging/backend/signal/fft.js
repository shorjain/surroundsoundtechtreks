/**
 * fft.js — Fast Fourier Transform (radix-2, iterative Cooley–Tukey).
 *
 * WHAT IT DOES
 *   Converts N samples into N frequency components (and back). We only need it
 *   to make correlation fast: correlating a 3-second recording (144k samples)
 *   with a 480-sample chirp directly is ~70M multiply-adds; via FFT it's ~10M.
 *
 * HOW (one paragraph)
 *   A DFT of size N splits into two DFTs of size N/2 (even- and odd-indexed
 *   samples), recombined with "twiddle factors" w = e^(−2πik/N):
 *       X[k]       = E[k] + w^k · O[k]
 *       X[k + N/2] = E[k] − w^k · O[k]
 *   Apply recursively → N·log₂N work instead of N². The iterative version
 *   first shuffles samples into "bit-reversed" order so each level of the
 *   recursion can be done in place, smallest blocks first.
 *
 * Complex numbers are kept as two parallel arrays: re[] and im[].
 * N must be a power of two (pad with zeros; see nextPow2).
 */

export function nextPow2(n) {
  let p = 1;
  while (p < n) p <<= 1;
  return p;
}

/**
 * In-place FFT. `inverse = true` computes the inverse (including the 1/N).
 * @param {Float64Array} re
 * @param {Float64Array} im
 */
export function fft(re, im, inverse = false) {
  const N = re.length;
  if ((N & (N - 1)) !== 0) throw new Error('fft: length must be a power of two');

  // 1. Bit-reversal permutation: element at index 0b0011 goes to 0b1100, etc.
  for (let i = 1, j = 0; i < N; i++) {
    let bit = N >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  // 2. Butterflies: combine blocks of size len/2 into blocks of size len.
  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= N; len <<= 1) {
    const half = len >> 1;
    const step = (sign * 2 * Math.PI) / len;
    for (let k = 0; k < half; k++) {
      const wr = Math.cos(step * k); // twiddle factor w^k
      const wi = Math.sin(step * k);
      for (let start = 0; start < N; start += len) {
        const a = start + k;
        const b = a + half;
        const tr = re[b] * wr - im[b] * wi; // w^k · O[k]
        const ti = re[b] * wi + im[b] * wr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < N; i++) {
      re[i] /= N;
      im[i] /= N;
    }
  }
}
