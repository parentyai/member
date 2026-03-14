'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: quality patrol mode switch supports all query modes', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('<option value="latest">latest</option>'));
  assert.ok(html.includes('<option value="top-risk">top-risk</option>'));
  assert.ok(html.includes('<option value="newly-detected-improvements">newly-detected-improvements</option>'));
  assert.ok(html.includes('<option value="observation-blockers">observation-blockers</option>'));
  assert.ok(html.includes('<option value="next-best-pr">next-best-pr</option>'));
  assert.ok(js.includes('const QUALITY_PATROL_QUERY_MODES = Object.freeze(['));
  assert.ok(js.includes('function buildQualityPatrolModeLabel(value)'));
  assert.ok(js.includes("document.getElementById('quality-patrol-mode-select')?.addEventListener('change'"));
  assert.ok(js.includes('function buildQualityPatrolQueryPath()'));
});
