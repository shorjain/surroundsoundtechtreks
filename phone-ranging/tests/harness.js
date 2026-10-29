/**
 * harness.js — a 40-line test runner that works in Node AND in a browser.
 * (Node: `node tests/run-node.js`.  Browser: open tests/index.html via any local server.)
 */

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, msg = 'assertion failed') {
  if (!cond) throw new Error(msg);
}

export function assertClose(actual, expected, tol, msg = '') {
  if (!(Math.abs(actual - expected) <= tol)) {
    throw new Error(`${msg} expected ${expected} ± ${tol}, got ${actual}`);
  }
}

/** Runs everything; `log(line, ok)` prints. Returns { passed, failed }. */
export async function runAll(log = console.log) {
  let passed = 0;
  let failed = 0;
  for (const { name, fn } of tests) {
    const t0 = performance.now();
    try {
      const note = await fn();
      passed++;
      log(`  ✓ ${name}  (${(performance.now() - t0).toFixed(0)} ms)${note ? '  — ' + note : ''}`, true);
    } catch (e) {
      failed++;
      log(`  ✗ ${name}\n      ${e.message}`, false);
    }
  }
  log(`\n${passed} passed, ${failed} failed`, failed === 0);
  return { passed, failed };
}
