'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase880: ops shell hides system-only blocks and advanced filters in first view', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('<div class="composer-primary-actions">'));
  assert.ok(html.includes('id="create-draft" type="button" class="composer-hidden-action" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="approve" type="button" class="composer-hidden-action" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="preview" type="button" class="composer-hidden-action" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="plan" type="button" class="composer-hidden-action" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="execute" type="button" class="composer-hidden-action" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('<div class="composer-state-machine" data-ui="composer-workbench-state" data-v3-ops-hidden="true">'));
  assert.ok(html.includes('data-ui="composer-scenario-step-overview" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="composer-trigger-order-note" class="note" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('<div id="monitor-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="monitor-role-visibility-reason"'));
  assert.ok(html.includes('id="monitor-insights-system-handoff" class="note monitor-system-diagnostics-handoff" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="monitor-insights-snapshot-mode"'));
  assert.ok(html.includes('id="monitor-insights-fallback-mode"'));
  assert.ok(html.includes('id="monitor-insights-read-limit" min="1" max="5000" value="1000" class="input-inline input-sm"'));
  assert.ok(html.includes('<div class="row" data-v3-ops-hidden="true">'));
  assert.ok(html.includes('id="city-pack-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="read-model-reflection-state" class="panel data-reflection-panel"'));
  assert.ok(html.includes('id="users-summary-analyze" type="button" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('for="city-pack-unified-filter-relation"'));
  assert.ok(html.includes('id="errors-summary-details" class="table-section section" data-json-collapsible="true" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="errors-trace" class="input-inline input-trace"'));
  assert.ok(html.includes('data-v3-advanced-filter="true"'));

  assert.ok(css.includes('[data-v3-ops-hidden="true"]'));
  assert.ok(css.includes('[data-v3-advanced-filter="true"]'));
  assert.ok(css.includes('.decision-action-btn[data-v3-action-hidden="true"]'));
});
