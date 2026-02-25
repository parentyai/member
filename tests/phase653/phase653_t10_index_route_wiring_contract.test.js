'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase653: index route wiring includes users analyze/export, llm usage summary, journey kpi, and internal jobs', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/os/users-summary/analyze'"));
  assert.ok(src.includes("pathname === '/api/admin/os/users-summary/export'"));
  assert.ok(src.includes("pathname === '/api/admin/os/llm-usage/summary'"));
  assert.ok(src.includes("pathname === '/api/admin/os/llm-usage/export'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-kpi'"));
  assert.ok(src.includes("pathname === '/internal/jobs/user-context-snapshot-build'"));
  assert.ok(src.includes("pathname === '/internal/jobs/journey-kpi-build'"));
});
