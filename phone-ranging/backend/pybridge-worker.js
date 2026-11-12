/**
 * Owns the long-lived Python process. The main thread blocks on a shared
 * flag; this thread is the one that can sit on stdout, because numpy takes
 * a couple of seconds to import and we only want to pay that once.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { spawn } from 'node:child_process';

const meta = new Int32Array(workerData.sab, 0, 2);
const bytes = new Uint8Array(workerData.sab, 8);
const DONE = 1;

const proc = spawn(process.env.PYTHON || 'python', ['-u', '-m', 'phone_ranging'], {
  cwd: workerData.pyRoot,
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});

let buf = '';
let stderr = '';
/** @type {{ resolve: (line: string) => void, reject: (err: Error) => void }[]} */
const queue = [];

proc.stdout.setEncoding('utf8');
proc.stdout.on('data', (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, nl).replace(/\r$/, '');
    buf = buf.slice(nl + 1);
    const job = queue.shift();
    if (job) job.resolve(line);
  }
});
proc.stderr.setEncoding('utf8');
proc.stderr.on('data', (chunk) => {
  stderr = (stderr + chunk).slice(-4000);
});

function failAll(err) {
  while (queue.length) queue.shift().reject(err);
}

proc.on('error', (err) => failAll(err));
proc.on('exit', (code) => {
  failAll(new Error((stderr || `python exited ${code}`).trim()));
});

function ask(obj) {
  return new Promise((resolve, reject) => {
    if (proc.exitCode != null) {
      reject(new Error((stderr || 'python ranging process exited').trim()));
      return;
    }
    queue.push({ resolve, reject });
    proc.stdin.write(`${JSON.stringify(obj)}\n`);
  });
}

function publish(line) {
  let encoded = Buffer.from(line, 'utf8');
  if (encoded.length > bytes.length) {
    encoded = Buffer.from(JSON.stringify({ ok: false, error: 'response too large' }));
  }
  bytes.set(encoded);
  Atomics.store(meta, 1, encoded.length);
  Atomics.store(meta, 0, DONE);
  Atomics.notify(meta, 0);
}

let chain = Promise.resolve();
parentPort.on('message', (req) => {
  chain = chain.then(async () => {
    try {
      const line = await ask({ op: req.op, ...req.payload });
      publish(line);
    } catch (err) {
      publish(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

parentPort.on('close', () => {
  proc.kill();
});
