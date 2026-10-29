/**
 * Call the Python geometry package (math, ranging, localization).
 *
 * One Python process stays up — importing numpy is slow — and each call is a
 * JSON line in, a JSON line out. The wait is synchronous because processRound
 * and the tests are synchronous.
 */

import { Worker } from 'node:worker_threads';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PAYLOAD = 1024 * 1024;
const sab = new SharedArrayBuffer(8 + PAYLOAD);
const meta = new Int32Array(sab, 0, 2); // [flag, length]
const BUSY = 2;
const DONE = 1;

let worker;

function ensure() {
  if (worker) return;
  worker = new Worker(new URL('./pybridge-worker.js', import.meta.url), {
    workerData: {
      sab,
      pyRoot: path.join(path.dirname(fileURLToPath(import.meta.url)), 'py'),
    },
  });
  worker.on('error', (err) => {
    Atomics.store(meta, 1, 0);
    const encoded = Buffer.from(JSON.stringify({ ok: false, error: err.message }));
    new Uint8Array(sab, 8).set(encoded);
    Atomics.store(meta, 1, encoded.length);
    Atomics.store(meta, 0, DONE);
    Atomics.notify(meta, 0);
  });
}

function call(op, payload) {
  ensure();
  // drop undefined / Infinity so the worker clone and the python JSON stay plain
  const clean = JSON.parse(JSON.stringify(payload));
  Atomics.store(meta, 0, BUSY);
  worker.postMessage({ op, payload: clean });
  while (Atomics.load(meta, 0) === BUSY) {
    const woke = Atomics.wait(meta, 0, BUSY, 60000);
    if (woke === 'timed-out' && Atomics.load(meta, 0) === BUSY) {
      throw new Error('python ranging timed out');
    }
  }
  const n = Atomics.load(meta, 1);
  const text = Buffer.from(new Uint8Array(sab, 8, n)).toString('utf8');
  const msg = JSON.parse(text);
  if (!msg.ok) throw new Error(msg.error);
  return msg.result;
}

// start python at import so the numpy load overlaps other startup work
ensure();

export function solveLayout(body) {
  return call('solve_layout', body);
}

export function finishRound(body) {
  return call('finish_round', body);
}

export function procrustesAlign(estimate, truth) {
  return call('procrustes', { estimate, truth });
}
