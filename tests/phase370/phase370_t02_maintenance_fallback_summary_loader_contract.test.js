'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase370: admin app loads read-path fallback summary via admin API', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'apps/admin/assets/admin_app.js'), 'utf8');
  assert.ok(src.includes('async function loadReadPathFallbackSummary(options)'));
  assert.ok(src.includes('/api/admin/read-path-fallback-summary?'));
  assert.ok(src.includes('renderReadPathFallbackSummary(state.readPathFallbackSummary);'));
});
