'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase26 t03: docs exist with required headings', () => {
  const plan = readFileSync('docs/archive/phases/PHASE26_PLAN.md', 'utf8');
  assert.ok(plan.includes('# PHASE26_PLAN'));
  assert.ok(plan.includes('Phase26の目的'));
  assert.ok(plan.includes('Phase26のスコープ'));
  assert.ok(plan.includes('Phase26 CLOSE条件'));

  const log = readFileSync('docs/archive/phases/PHASE26_EXECUTION_LOG.md', 'utf8');
  assert.ok(log.includes('Phase26-T01-03'));
  assert.ok(log.includes('main SHA'));
  assert.ok(log.includes('npm test'));
});
