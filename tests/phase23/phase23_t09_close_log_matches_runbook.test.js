import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const log = readFileSync('docs/archive/phases/PHASE23_EXECUTION_LOG.md', 'utf8');

test('phase23 t09: close declaration includes phaseResult and closeDecision', () => {
  assert.match(log, /phaseResult=/);
  assert.match(log, /closeDecision=/);
});
