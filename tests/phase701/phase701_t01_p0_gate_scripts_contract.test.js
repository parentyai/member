'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase701: package scripts expose P0 consistency gates and catchup chain', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:collection-drift:check'], 'node scripts/check_collection_drift.js');
  assert.equal(pkg.scripts['audit:phase-origin:check'], 'node scripts/check_phase_origin.js');
  assert.equal(pkg.scripts['audit:unreachable:check'], 'node scripts/check_unreachable_classification.js');
  assert.equal(pkg.scripts['audit:scenariokey-drift:check'], 'node scripts/check_scenariokey_drift.js');

  const catchup = String(pkg.scripts['catchup:drift-check'] || '');
  assert.ok(catchup.includes('audit:collection-drift:check'));
  assert.ok(catchup.includes('audit:phase-origin:check'));
  assert.ok(catchup.includes('audit:unreachable:check'));
  assert.ok(catchup.includes('audit:scenariokey-drift:check'));
});
