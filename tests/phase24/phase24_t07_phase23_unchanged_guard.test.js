'use strict';

const assert = require('assert');
const { readFileSync } = require('node:fs');
const test = require('node:test');

test('phase24 t07: phase23 runbook still contains decision table keys', () => {
  const runbook = readFileSync('docs/archive/phases/PHASE23_RUNBOOK.md', 'utf8');
  assert.ok(runbook.includes('result'));
  assert.ok(runbook.includes('failure_class'));
  assert.ok(runbook.includes('nextAction'));
});
