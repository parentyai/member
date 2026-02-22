'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function read(file) {
  return fs.readFileSync(path.join(process.cwd(), file), 'utf8');
}

test('phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query', () => {
  const dashboard = read('src/routes/admin/osDashboardKpi.js');
  const opsOverview = read('src/routes/admin/opsOverview.js');
  const phase5Ops = read('src/routes/phase5Ops.js');
  const phase5State = read('src/routes/phase5State.js');

  assert.ok(dashboard.includes('resolveFallbackModeDefault'));
  assert.ok(dashboard.includes('return resolveFallbackModeDefault();'));

  [opsOverview, phase5Ops, phase5State].forEach((src) => {
    assert.ok(src.includes('resolveFallbackModeDefault'));
    assert.ok(src.includes('if (value === null || value === undefined || value === \'\') return resolveFallbackModeDefault();'));
    assert.ok(src.includes('normalizeFallbackMode(value)'));
  });
});
