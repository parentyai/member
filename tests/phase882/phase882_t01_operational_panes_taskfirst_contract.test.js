'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase882: members and regional ops panes stay task-first in ops shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  assert.ok(html.includes('id="read-model-task-summary"'));
  assert.ok(html.includes('id="city-pack-task-summary"'));
  assert.ok(html.includes('id="emergency-task-summary"'));
  assert.ok(html.includes('id="emergency-layer-pane-details" class="decision-details section" data-workbench-zone="true" open'));
  assert.ok(html.includes('data-dict-key="ui.label.emergency.col.evidence" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('data-dict-key="ui.label.emergency.col.traceId" data-v3-ops-hidden="true"'));

  assert.ok(js.includes('function resolveReadModelTaskSummary() {'));
  assert.ok(js.includes('function resolveCityPackTaskSummary() {'));
  assert.ok(js.includes('function resolveEmergencyLayerTaskSummary() {'));
  assert.ok(js.includes("renderDecisionCard('read-model', resolveReadModelDecisionVm());"));
  assert.ok(js.includes("renderDecisionCard('city-pack', resolveCityPackDecisionVm());"));
  assert.ok(js.includes("renderDecisionCard('emergency-layer', resolveEmergencyLayerDecisionVm());"));
  assert.ok(js.includes("document.getElementById('users-filter-line-user-id')?.focus();"));
  assert.ok(js.includes('const statusFilter = document.getElementById(\'city-pack-unified-filter-status\');'));
  assert.ok(js.includes('statusFilter?.focus();'));
  assert.ok(js.includes("document.getElementById('emergency-bulletin-status-filter')?.focus();"));

  assert.ok(dict.includes('"ui.label.readModel.prioritySummary": "最初に確認すること"'));
  assert.ok(dict.includes('"ui.label.cityPack.prioritySummary": "最初に確認すること"'));
  assert.ok(dict.includes('"ui.label.emergency.prioritySummary": "最初に確認すること"'));

  assert.ok(ssot.includes('## Members / Regional Ops Task-First Surface（Phase882 add-only）'));
});
