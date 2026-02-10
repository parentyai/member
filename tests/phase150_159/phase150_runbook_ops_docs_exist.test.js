'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase150: RUNBOOK_OPS exists with required headings', () => {
  const runbook = readFileSync('docs/RUNBOOK_OPS.md', 'utf8');
  assert.ok(runbook.includes('# RUNBOOK_OPS'));
  assert.ok(runbook.includes('Purpose'));
  assert.ok(runbook.includes('Steps'));
  assert.ok(runbook.includes('STOP Criteria'));
  assert.ok(runbook.includes('Trace Search'));
  assert.ok(runbook.includes('Rollback'));
});

