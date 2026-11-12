/**
 * simulate.js — fake phones, fake rooms, fake recordings, with KNOWN answers.
 *
 * Before touching real hardware, every part of the pipeline should be proven on
 * data where we know the truth. The simulator produces exactly what real phones
 * would upload, including the nasty parts:
 *
 *   - each phone starts recording at a different, unknown time   (S_i)
 *   - each phone beeps at a sloppy time (network-scheduled)      (T_j jitter)
 *   - beeps arrive at FRACTIONAL sample positions (computed exactly, not rounded)
 *   - sound gets quieter with distance (1/r)
 *   - optional wall reflection (image-source method) → echoes
 *   - optional "shadowing" of the direct path (phone facing away)
 *   - optional sample-rate error per phone (ppm)                 (ε_i)
 *   - white noise
 *
 * Everything is driven by a seeded random generator, so a failing test can be
 * replayed exactly.
 */

import { chirpAt } from './signal/chirp.js';

// ---------------------------------------------------------------------------
// Seeded randomness
// ---------------------------------------------------------------------------

/** mulberry32: tiny, decent, seedable PRNG returning uniform [0, 1). */
export function makeRng(seed = 1) {
  let a = seed >>> 0;
  const uniform = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  // Box–Muller: two uniforms → one standard normal.
  const gaussian = () => {
    const u = Math.max(uniform(), 1e-12);
    const v = uniform();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { uniform, gaussian };
}

// ---------------------------------------------------------------------------
// Level 1: distances only (tests the geometry solver in isolation)
// ---------------------------------------------------------------------------

/** Random layout of n phones inside a width × height rectangle, ≥ minGap apart. */
export function randomLayout(n, { width = 4, height = 3, minGap = 0.4, seed = 1 } = {}) {
  const rng = makeRng(seed);
  const pts = [];
  while (pts.length < n) {
    const p = [rng.uniform() * width, rng.uniform() * height];
    if (pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= minGap)) pts.push(p);
  }
  return pts;
}

/**
 * True pairwise distances + Gaussian noise + optional outliers.
 * @param {number[][]} positions
 * @param {{ sigma?: number, seed?: number, outliers?: {a:number,b:number,extra:number}[], ids?: string[] }} opts
 */
export function simulateDistances(positions, { sigma = 0.02, seed = 2, outliers = [], ids } = {}) {
  const rng = makeRng(seed);
  const name = (k) => (ids ? ids[k] : String.fromCharCode(65 + k)); // A, B, C…
  const out = [];
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const truth = Math.hypot(positions[i][0] - positions[j][0], positions[i][1] - positions[j][1]);
      let d = truth + sigma * rng.gaussian();
      const o = outliers.find((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i));
      if (o) d += o.extra; // echo locks make distances LONGER
      out.push({ a: name(i), b: name(j), d, sigma, truth });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Level 2: raw audio (tests the whole pipeline end to end)
// ---------------------------------------------------------------------------

/**
 * Mirror point p across the wall line y = wallY (image-source method).
 * A reflection off a flat wall sounds exactly like a second speaker standing
 * at the mirror-image position, behind the wall.
 */
const mirrorAcrossY = ([x, y], wallY) => [x, 2 * wallY - y];

/**
 * @param {object} p
 * @param {{ id, pos:[number,number], slot, selfDistance? }[]} p.phones
 * @param {{ f0, f1, duration }} p.chirp
 * @param {number} p.slotSeconds
 * @param {number} [p.sampleRate]
 * @param {number} [p.c]                 speed of sound
 * @param {number} [p.noise]             noise std-dev (chirp amplitude at 1 m = 1)
 * @param {number} [p.startJitterS]      ± random error in each phone's recording start
 * @param {number} [p.emitJitterS]       ± random error in each phone's beep time
 * @param {number|null} [p.wallY]        wall at y = wallY (null = no echoes)
 * @param {number} [p.wallReflection]    amplitude factor of the echo (0…1)
 * @param {{listener, source, gainDb}[]} [p.shadow]   weaken specific direct paths
 * @param {Record<string, number>} [p.ppm]            sample-rate error per phone
 * @param {number} [p.leadInS]           silence before slot 0
 * @param {number} [p.seed]
 */
export function simulateRecordings({
  phones,
  chirp,
  slotSeconds,
  sampleRate = 48000,
  c = 343.2,
  noise = 0.002,
  startJitterS = 0.03,
  emitJitterS = 0.02,
  wallY = null,
  wallReflection = 0.6,
  shadow = [],
  ppm = {},
  leadInS = 0.3,
  seed = 3,
}) {
  const rng = makeRng(seed);
  const jitter = (s) => (rng.uniform() * 2 - 1) * s;

  // Global timeline (seconds). Each phone's beep time T_j and recording start S_i.
  const T = {};
  const S = {};
  for (const ph of phones) {
    T[ph.id] = leadInS + ph.slot * slotSeconds + jitter(emitJitterS);
    S[ph.id] = jitter(startJitterS);
  }
  const lastSlot = Math.max(...phones.map((p) => p.slot));
  const totalS = leadInS + (lastSlot + 1) * slotSeconds + 0.3;

  const recordings = {};
  for (const listener of phones) {
    const fsTrue = sampleRate * (1 + (ppm[listener.id] || 0) * 1e-6); // ε_i
    const N = Math.round(totalS * sampleRate);
    const x = new Float64Array(N);

    // Each sound path = (emit time, path length, amplitude).
    const paths = [];
    for (const source of phones) {
      const isSelf = source.id === listener.id;
      const direct = isSelf
        ? source.selfDistance ?? 0.12
        : Math.hypot(source.pos[0] - listener.pos[0], source.pos[1] - listener.pos[1]);
      const sh = shadow.find((s) => s.listener === listener.id && s.source === source.id);
      const shadowGain = sh ? 10 ** (sh.gainDb / 20) : 1;
      paths.push({ t0: T[source.id], len: direct, amp: shadowGain / Math.max(direct, 0.05) });

      if (wallY !== null && !isSelf) {
        const img = mirrorAcrossY(source.pos, wallY);
        const len = Math.hypot(img[0] - listener.pos[0], img[1] - listener.pos[1]);
        paths.push({ t0: T[source.id], len, amp: wallReflection / len });
      }
    }

    // Render: sample n of this phone's recording is global time S_i + n / fs_true.
    for (const { t0, len, amp } of paths) {
      const arrive = t0 + len / c; // global arrival time
      const nStart = Math.max(0, Math.floor((arrive - S[listener.id]) * fsTrue));
      const nEnd = Math.min(N, Math.ceil((arrive + chirp.duration - S[listener.id]) * fsTrue) + 1);
      for (let n = nStart; n < nEnd; n++) {
        const tGlobal = S[listener.id] + n / fsTrue;
        x[n] += amp * chirpAt(tGlobal - arrive, chirp);
      }
    }
    for (let n = 0; n < N; n++) x[n] += noise * rng.gaussian();

    // Real recordings live in −1…+1 (beyond that the mic clips). The 1/r
    // loudness model above puts the own beep (12 cm away) around 8, so scale the
    // whole recording — signal AND noise together, so SNR is unchanged — to a
    // realistic peak of 0.5.
    let peak = 0;
    for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(x[n]));
    if (peak > 0) for (let n = 0; n < N; n++) x[n] *= 0.5 / peak;

    recordings[listener.id] = { samples: x, sampleRate };
  }

  return { recordings, truth: { T, S } };
}
