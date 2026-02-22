'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase579: dashboard UI requests fallbackMode=block', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('/api/admin/os/dashboard/kpi?windowMonths='));
  assert.ok(js.includes('fallbackMode=block'));
});
