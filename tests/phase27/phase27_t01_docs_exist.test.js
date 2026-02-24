'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase27 t01: docs exist with required headings', () => {
  const plan = readFileSync('docs/archive/phases/PHASE27_PLAN.md', 'utf8');
  assert.ok(plan.includes('# PHASE27_PLAN'));
  assert.ok(plan.includes('Phase27の目的'));
  assert.ok(plan.includes('Scope In'));
  assert.ok(plan.includes('Scope Out'));
  assert.ok(plan.includes('CLOSE条件'));
  assert.ok(plan.includes('既存Phaseとの非改変宣言'));

  const log = readFileSync('docs/archive/phases/PHASE27_EXECUTION_LOG.md', 'utf8');
  assert.ok(log.includes('Phase27 START'));
  assert.ok(log.includes('main SHA'));
  assert.ok(log.includes('Rollback'));
});
