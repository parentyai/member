'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase28 t01: docs exist with required headings', () => {
  const plan = readFileSync('docs/PHASE28_PLAN.md', 'utf8');
  assert.ok(plan.includes('# PHASE28_PLAN'));
  assert.ok(plan.includes('Phase28の目的'));
  assert.ok(plan.includes('Scope In'));
  assert.ok(plan.includes('Scope Out'));
  assert.ok(plan.includes('CLOSE条件'));
  assert.ok(plan.includes('既存Phaseとの非改変宣言'));

  const log = readFileSync('docs/PHASE28_EXECUTION_LOG.md', 'utf8');
  assert.ok(log.includes('Phase28 START'));
  assert.ok(log.includes('main SHA'));
  assert.ok(log.includes('Rollback'));
});
