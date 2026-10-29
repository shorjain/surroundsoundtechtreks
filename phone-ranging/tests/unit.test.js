/**
 * unit.test.js — signal processing and storage.
 * Geometry (linear algebra, ranging, localization) is tested in backend/py/tests.
 */
import { test, assert, assertClose } from './harness.js';
import { fft } from '../backend/signal/fft.js';
import { makeChirp, chirpAt } from '../backend/signal/chirp.js';
import { matchedFilter } from '../backend/signal/matchedFilter.js';
import { findEarliestPeak, median } from '../backend/signal/detectArrivals.js';
import { makeRng } from '../backend/simulate.js';
import { encodeWavFloat32, decodeWavFloat32, float32ToBase64, base64ToFloat32 } from '../backend/server/wav.js';

test('fft(): matches a slow direct DFT, and inverse round-trips', () => {
  const rng = makeRng(3);
  const N = 64;
  const x = Float64Array.from({ length: N }, () => rng.gaussian());
  const re = Float64Array.from(x);
  const im = new Float64Array(N);
  fft(re, im);
  for (const k of [0, 1, 5, 31, 32, 63]) {
    let sr = 0;
    let si = 0;
    for (let t = 0; t < N; t++) {
      sr += x[t] * Math.cos((-2 * Math.PI * k * t) / N);
      si += x[t] * Math.sin((-2 * Math.PI * k * t) / N);
    }
    assertClose(re[k], sr, 1e-9, `bin ${k} re`);
    assertClose(im[k], si, 1e-9, `bin ${k} im`);
  }
  fft(re, im, true);
  for (let t = 0; t < N; t++) assertClose(re[t], x[t], 1e-12);
});

test('matched filter + earliest peak: finds a chirp at a FRACTIONAL delay', () => {
  const fs = 48000;
  const chirp = { f0: 2000, f1: 6000, duration: 0.01 };
  const template = makeChirp({ ...chirp, sampleRate: fs });
  const trueDelay = 1234.37; // samples
  const rng = makeRng(11);
  const x = new Float64Array(4000);
  for (let n = 0; n < x.length; n++) x[n] = 0.3 * chirpAt((n - trueDelay) / fs, chirp) + 0.01 * rng.gaussian();
  const { envelope } = matchedFilter(x, template);
  const hit = findEarliestPeak(envelope, { noise: median(envelope) });
  assertClose(hit.index, trueDelay, 0.1, 'delay (samples)');
  return `error ${(hit.index - trueDelay).toFixed(3)} samples, SNR ${hit.snrDb.toFixed(1)} dB`;
});

test('earliest-peak rule picks a WEAK direct path over a STRONGER later echo', () => {
  const fs = 48000;
  const chirp = { f0: 2000, f1: 6000, duration: 0.01 };
  const template = makeChirp({ ...chirp, sampleRate: fs });
  const direct = 1000;
  const echo = 1000 + 60; // 60 samples later ≈ 43 cm extra path
  const x = new Float64Array(3000);
  for (let n = 0; n < x.length; n++) {
    x[n] = 0.5 * chirpAt((n - direct) / fs, chirp) + 1.0 * chirpAt((n - echo) / fs, chirp);
  }
  const { envelope } = matchedFilter(x, template);
  const hit = findEarliestPeak(envelope, { noise: 1e-3 });
  assertClose(hit.index, direct, 1, 'should lock onto the direct path');
  assert(hit.isStrongest === false, 'the echo really was stronger');
});

test('WAV + base64 round-trip', () => {
  const s = Float32Array.from([0, 0.5, -0.25, 1e-3]);
  const back = decodeWavFloat32(encodeWavFloat32(s, 48000));
  assert(back.sampleRate === 48000);
  s.forEach((v, k) => assertClose(back.samples[k], v, 1e-7));
  base64ToFloat32(float32ToBase64(s)).forEach((v, k) => assertClose(v, s[k], 0));
});
