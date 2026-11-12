// node tests/run-node.js
import './unit.test.js';
import './endToEnd.test.js';
import { runAll } from './harness.js';

const { failed } = await runAll((line) => console.log(line));
process.exit(failed ? 1 : 0);
