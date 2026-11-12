/**
 * endToEnd.test.js — simulated raw audio all the way to a map, and the HTTP API.
 */
import { test, assert } from './harness.js';
import { simulateRecordings, randomLayout } from '../backend/simulate.js';
import { processRound } from '../backend/processRound.js';
import { procrustesAlign } from '../backend/pybridge.js';
import { createApp } from '../backend/server/app.js';
import { float32ToBase64 } from '../backend/server/wav.js';

const CHIRP = { f0: 2000, f1: 6000, duration: 0.01 };
const SLOT = 0.3;

function makePhones(positions) {
  return positions.map((pos, k) => ({ id: String.fromCharCode(65 + k), pos, slot: k, selfDistance: 0.12 }));
}

function runRound(phones, simOpts = {}) {
  const { recordings } = simulateRecordings({ phones, chirp: CHIRP, slotSeconds: SLOT, ...simOpts });
  const result = processRound({ phones, recordings, config: { chirp: CHIRP, slotSeconds: SLOT, temperatureC: 20 } });
  const est = result.layout.phones.map((p) => [p.x, p.y]);
  const truth = phones.map((p) => p.pos);
  return { result, ...procrustesAlign(est, truth) };
}

test('E2E: 5 phones, clean room, noise + sloppy timing → sub-cm map', () => {
  const phones = makePhones(randomLayout(5, { seed: 61, width: 4, height: 3 }));
  const { result, rmse } = runRound(phones, { seed: 62 });
  assert(result.loops.badCount === 0, `bad loops: ${result.loops.badCount}`);
  assert(result.layout.dropped.length === 0);
  assert(rmse < 0.01, `rmse ${rmse}`);
  return `position RMSE ${(rmse * 1000).toFixed(1)} mm`;
});

test('E2E: wall echoes present but direct path OK → still accurate', () => {
  const phones = makePhones(randomLayout(5, { seed: 71, width: 4, height: 3 }));
  const { rmse } = runRound(phones, { seed: 72, wallY: 3.6, wallReflection: 0.7 });
  assert(rmse < 0.015, `rmse ${rmse}`);
  return `position RMSE ${(rmse * 1000).toFixed(1)} mm`;
});

test('E2E: one direct path shadowed below the echo → loop check AND χ² both catch it', () => {
  const phones = makePhones(randomLayout(6, { seed: 81, width: 4, height: 3 }));
  // Phone C barely hears E directly (−40 dB: facing away + body shadow), while the
  // wall echo arrives at normal strength → C locks onto the echo.
  const { result, rmse } = runRound(phones, {
    seed: 82,
    wallY: 3.4,
    wallReflection: 0.9,
    shadow: [{ listener: 'C', source: 'E', gainDb: -40 }],
  });
  const suspectCE = result.loops.suspicion['C–E'] || 0;
  assert(result.loops.badCount > 0, 'loop check should flag something');
  assert(suspectCE >= 3, `C–E should be in the most bad loops, got ${JSON.stringify(result.loops.suspicion)}`);
  const dropped = result.layout.dropped.map((d) => [d.a, d.b].sort().join('–'));
  assert(dropped.includes('C–E'), `solver dropped ${dropped}`);
  assert(rmse < 0.02, `rmse ${rmse}`);
  return `C–E flagged in ${suspectCE} bad loops, dropped by χ²; RMSE ${(rmse * 1000).toFixed(1)} mm`;
});

test('E2E: real-phone timing slop (±100 ms beep jitter, 0.5 s slots) still works', () => {
  const phones = makePhones(randomLayout(5, { seed: 95 }));
  const chirp = CHIRP;
  const { recordings } = simulateRecordings({ phones, chirp, slotSeconds: 0.5, emitJitterS: 0.1, startJitterS: 0.2, seed: 96 });
  const result = processRound({ phones, recordings, config: { chirp, slotSeconds: 0.5 } });
  const { rmse } = procrustesAlign(result.layout.phones.map((p) => [p.x, p.y]), phones.map((p) => p.pos));
  assert(result.missing.length === 0, `missing ${result.missing}`);
  assert(rmse < 0.01, `rmse ${rmse}`);
  return `position RMSE ${(rmse * 1000).toFixed(1)} mm`;
});

test('E2E: 50 ppm sample-rate mismatch costs only millimetres', () => {
  const phones = makePhones(randomLayout(5, { seed: 91 }));
  const { rmse } = runRound(phones, { seed: 92, ppm: { A: 25, B: -25, C: 10, D: 0, E: -15 } });
  assert(rmse < 0.01, `rmse ${rmse}`);
  return `position RMSE ${(rmse * 1000).toFixed(1)} mm`;
});

/** What the phone page sends: the sample where it scheduled its own beep (here: the exact truth). */
function attachExpectedOwn(phones, recordings, truth, c = 343.2) {
  for (const p of phones) {
    const rec = recordings[p.id];
    rec.meta = { expectedOwnIndex: (truth.T[p.id] + p.selfDistance / c - truth.S[p.id]) * rec.sampleRate };
  }
}

test('Own-beep check: clean round → every own beep confident and on schedule', () => {
  const phones = makePhones(randomLayout(5, { seed: 101 }));
  const { recordings, truth } = simulateRecordings({ phones, chirp: CHIRP, slotSeconds: 0.5, seed: 102 });
  attachExpectedOwn(phones, recordings, truth);
  const result = processRound({ phones, recordings, config: { chirp: CHIRP, slotSeconds: 0.5 } });
  for (const [id, det] of Object.entries(result.detections)) {
    assert(!det.own.ambiguous, `${id} margin ${det.own.marginDb} dB`);
    assert(!det.own.wrongSlot && Math.abs(det.own.scheduleOffsetS) < 1e-3, `${id} offset ${det.own.scheduleOffsetS}`);
  }
  assert(result.rejected.length === 0 && result.unplaced.length === 0);
  const minMargin = Math.min(...Object.values(result.detections).map((d) => d.own.marginDb));
  return `smallest own-beep margin ${minMargin.toFixed(1)} dB`;
});

test('Own-beep check: quiet own beep (earpiece) → wrong beep picked, flagged, map still solved', () => {
  // C's own beep comes out 40 dB quieter (earpiece instead of loudspeaker), so
  // some other phone's beep is the loudest thing C hears. Real phones beep with
  // tens of ms of timing slop, which then leaks straight into C's distances.
  const phones = makePhones(randomLayout(6, { seed: 111, width: 4, height: 3 }));
  const { recordings, truth } = simulateRecordings({
    phones, chirp: CHIRP, slotSeconds: 0.5, emitJitterS: 0.05, seed: 112,
    shadow: [{ listener: 'C', source: 'C', gainDb: -40 }],
  });
  attachExpectedOwn(phones, recordings, truth);
  const result = processRound({ phones, recordings, config: { chirp: CHIRP, slotSeconds: 0.5 } });
  const c = result.detections.C.own;
  assert(c.wrongSlot, `C should be on the wrong slot, offset ${c.scheduleOffsetS}`);
  for (const id of ['A', 'B', 'D', 'E', 'F']) assert(!result.detections[id].own.wrongSlot, `${id} wrongly flagged`);
  assert(result.layout, `no map: ${result.layoutError}`);
  assert(result.rejected.length > 0, 'expected negative distances from C');
  for (const r of result.rejected) assert(r.suspects.includes('C'), `rejected ${r.a}–${r.b} without suspecting C`);
  const usedPairs = result.layout.pairs.map((p) => p.measured);
  assert(usedPairs.every((d) => d > 0), 'a non-positive distance reached the solver');
  return `C offset ${(c.scheduleOffsetS * 1000).toFixed(0)} ms, ${result.rejected.length} pair(s) rejected, ` +
    `${result.layout.dropped.length} dropped by χ²`;
});

test('API: session → join ×4 → round → upload ×4 → map', () => {
  let clock = 1_000_000;
  const app = createApp({ now: () => clock });
  const call = (m, p, b) => {
    const r = app.handle(m, p, b);
    if (r.status !== 200) throw new Error(`${m} ${p} → ${r.status} ${JSON.stringify(r.json)}`);
    return r.json;
  };

  const sid = call('POST', '/api/sessions').id;
  const positions = [[0, 0], [2, 0], [2, 1.5], [0.3, 1.8]];
  for (const name of ['A', 'B', 'C', 'D']) call('POST', `/api/sessions/${sid}/join`, { name, selfDistance: 0.12 });
  call('PUT', `/api/sessions/${sid}/labels`, { room: 'sim', truePositions: positions });
  const { round } = call('POST', `/api/sessions/${sid}/rounds`, { band: '2-6k' });

  // Pretend to be the phones: simulate what they would record and upload it.
  const phones = ['A', 'B', 'C', 'D'].map((id, k) => ({ id, pos: positions[k], slot: k, selfDistance: 0.12 }));
  const { recordings } = simulateRecordings({
    phones,
    chirp: round.schedule.chirp,
    slotSeconds: round.schedule.slotSeconds,
    leadInS: round.schedule.leadInS,
    seed: 5,
  });
  let status;
  for (const p of phones) {
    status = call('POST', `/api/sessions/${sid}/rounds/${round.number}/upload`, {
      phoneId: p.id,
      sampleRate: recordings[p.id].sampleRate,
      samplesBase64: float32ToBase64(recordings[p.id].samples),
    }).status;
  }
  assert(status === 'done', `round status ${status}`);
  const res = call('GET', `/api/sessions/${sid}/rounds/${round.number}`);
  const { rmse } = procrustesAlign(res.result.layout.phones.map((p) => [p.x, p.y]), positions);
  assert(rmse < 0.01, `rmse ${rmse}`);

  // Distances-only endpoint.
  const solved = call('POST', '/api/solve', {
    distances: [
      { a: 'A', b: 'B', d: 2 }, { a: 'A', b: 'C', d: 2.5 }, { a: 'B', b: 'C', d: 1.5 },
      { a: 'A', b: 'D', d: 1.5 }, { a: 'B', b: 'D', d: 2.5 }, { a: 'C', b: 'D', d: 2 },
    ],
  });
  assert(solved.phones.length === 4 && solved.stats.passed);
  return `round RMSE ${(rmse * 1000).toFixed(1)} mm`;
});
