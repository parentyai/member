'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase882: members and regional ops panes stay task-first in ops shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  assert.ok(html.includes('id="read-model-task-summary"'));
  assert.ok(html.includes('id="city-pack-task-summary"'));
  assert.ok(html.includes('id="emergency-task-summary"'));
  assert.ok(html.includes('id="emergency-layer-pane-details" class="decision-details section" data-workbench-zone="true" data-workbench-collapsible="true"'));
  assert.ok(html.includes('data-dict-key="ui.label.emergency.col.evidence" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('data-dict-key="ui.label.emergency.col.traceId" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="city-pack-operator-surface"'));
  assert.ok(html.includes('data-city-pack-operator-mode="guide"'));
  assert.ok(html.includes('data-city-pack-operator-mode="emergency"'));

  assert.ok(js.includes('function resolveReadModelTaskSummary() {'));
  assert.ok(js.includes('function resolveCityPackTaskSummary() {'));
  assert.ok(js.includes('function resolveEmergencyLayerTaskSummary() {'));
  assert.ok(js.includes('function syncUsersSummaryDetailRailVisibility(hasDetail) {'));
  assert.ok(js.includes("renderDecisionCard('read-model', resolveReadModelDecisionVm());"));
  assert.ok(js.includes("renderDecisionCard('city-pack', resolveCityPackDecisionVm());"));
  assert.ok(js.includes("renderDecisionCard('emergency-layer', resolveEmergencyLayerDecisionVm());"));
  assert.ok(js.includes("cityPackOperatorMode: CITY_PACK_OPERATOR_MODE.guide"));
  assert.ok(js.includes("cityPackOperatorMode: CITY_PACK_OPERATOR_MODE.emergency"));
  assert.ok(js.includes("document.getElementById('city-pack-operator-mode-guide')?.focus();"));
  assert.ok(js.includes("document.getElementById('city-pack-operator-mode-emergency')?.focus();"));
  assert.ok(js.includes('state.usersSummarySelectedLineUserId'));

  assert.ok(css.includes('.read-model-workspace-grid.is-detail-empty'));
  assert.ok(css.includes('#pane-city-pack .data-workspace-grid'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.readModel.prioritySummary',
    'ui.label.cityPack.prioritySummary',
    'ui.label.emergency.prioritySummary',
  ]);

  assert.ok(ssot.includes('## Members / Regional Ops Task-First Surface（Phase882 add-only）'));
  assert.ok(ssot.includes('## Operator Minimal UI Reset（Phase890 add-only）'));
});
