'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase880: ops shell hides system-only blocks and advanced filters in first view', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('<div class="composer-primary-actions" data-v3-ops-hidden="true">'));
  assert.ok(html.includes('<div class="composer-state-machine" data-ui="composer-workbench-state" data-v3-ops-hidden="true">'));
  assert.ok(html.includes('<div id="monitor-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="monitor-role-visibility-reason"'));
  assert.ok(html.includes('id="monitor-insights-system-handoff" class="note monitor-system-diagnostics-handoff" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="city-pack-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="read-model-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="users-summary-analyze" type="button" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('for="city-pack-unified-filter-relation">関係ID</label>'));
  assert.ok(html.includes('data-v3-advanced-filter="true"'));

  assert.ok(css.includes('[data-v3-ops-hidden="true"]'));
  assert.ok(css.includes('[data-v3-advanced-filter="true"]'));
  assert.ok(css.includes('.decision-action-btn[data-v3-action-hidden="true"]'));
});
