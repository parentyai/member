'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase107: docs exist with required headings', () => {
  const plan = readFileSync('docs/PHASE101_108_PLAN.md', 'utf8');
  assert.ok(plan.includes('# PHASE101_108_PLAN'));
  assert.ok(plan.includes('Purpose'));
  assert.ok(plan.includes('Scope In'));
  assert.ok(plan.includes('Done Definition'));

  const log = readFileSync('docs/PHASE101_108_EXECUTION_LOG.md', 'utf8');
  assert.ok(log.includes('# PHASE101_108_EXECUTION_LOG'));
  assert.ok(log.includes('main SHA'));

  const runbook = readFileSync('docs/RUNBOOK_OPS_ASSIST.md', 'utf8');
  assert.ok(runbook.includes('# RUNBOOK_OPS_ASSIST'));
  assert.ok(runbook.includes('Steps'));
});
