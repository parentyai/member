'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: admin app exposes quality patrol pane shell and controls', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('data-pane-target="quality-patrol"'));
  assert.ok(html.includes('id="pane-quality-patrol"'));
  assert.ok(html.includes('id="quality-patrol-mode-select"'));
  assert.ok(html.includes('id="quality-patrol-audience-select"'));
  assert.ok(html.includes('id="quality-patrol-refresh"'));
  assert.ok(html.includes('id="quality-patrol-observation-blockers"'));
  assert.ok(html.includes('id="quality-patrol-recommended-pr"'));
  assert.ok(html.includes('id="quality-patrol-issues"'));
  assert.ok(html.includes('id="quality-patrol-evidence"'));
  assert.ok(html.includes('id="quality-patrol-evidence-availability-status"'));
  assert.ok(html.includes('id="quality-patrol-evidence-availability-summary"'));
  assert.ok(html.includes('id="quality-patrol-trace-refs"'));
});
