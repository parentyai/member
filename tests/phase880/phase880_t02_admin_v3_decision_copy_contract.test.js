'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase880: ops shell keeps decision copy map and operator destination contracts aligned', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  assert.ok(js.includes('const V3_DECISION_CARD_COPY_MAP = Object.freeze({'));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.home.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.alerts.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.composer.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.monitor.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.readModel.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.cityPack.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.emergencyLayer.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.faq.title'"));
  assert.ok(js.includes('function syncV3DecisionCard(paneKey) {'));
  assert.ok(js.includes('syncV3DecisionCard(paneKey);'));
  assert.ok(js.includes('const OPERATOR_DESTINATION_MAP = Object.freeze({'));
  assert.ok(js.includes('const OPERATOR_PREVIEW_ACTION_MODEL = Object.freeze({'));
  assert.ok(js.includes('const SYSTEM_CONSOLE_SECTION_ORDER = Object.freeze(['));
  assert.ok(js.includes("nextActionLabel: '地域案内を開く'"));
  assert.ok(js.includes("nextActionLabel: '緊急対応を開く'"));
  assert.ok(js.includes("nextActionLabel: 'FAQを開く'"));
  assert.ok(js.includes("openOperatorDestinationPane('city-pack', {"));
  assert.ok(js.includes('titleFallback:'));
  assert.ok(js.includes('hideTertiary: true'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.v3.decision.home.title',
    'ui.label.v3.decision.alerts.secondary',
    'ui.label.v3.decision.composer.title',
    'ui.label.v3.decision.composer.secondary',
    'ui.label.v3.decision.monitor.title',
    'ui.label.v3.decision.monitor.secondary',
    'ui.label.v3.decision.errors.title',
    'ui.label.v3.decision.errors.secondary',
    'ui.label.v3.decision.readModel.title',
    'ui.label.v3.decision.readModel.primary',
    'ui.label.v3.decision.cityPack.title',
    'ui.label.v3.decision.cityPack.primary',
    'ui.label.v3.decision.cityPack.secondary',
    'ui.label.v3.decision.emergencyLayer.title',
    'ui.label.v3.decision.emergencyLayer.primary',
    'ui.label.v3.decision.emergencyLayer.secondary',
    'ui.label.v3.decision.faq.title',
    'ui.label.v3.decision.faq.primary',
    'ui.label.v3.decision.faq.secondary',
  ]);

  assert.ok(ssot.includes('## Ops First-View Noise Budget（Phase880 add-only）'));
  assert.ok(ssot.includes('## Home / Alerts Task-First Surface（Phase881 add-only）'));
  assert.ok(ssot.includes('## Operator Minimal UI Reset（Phase890 add-only）'));
  assert.ok(ssot.includes('`data-v3-ops-hidden="true"`'));
  assert.ok(ssot.includes('`data-v3-advanced-filter="true"`'));
});
