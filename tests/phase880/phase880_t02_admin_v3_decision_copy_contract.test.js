'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase880: ops shell rewrites decision card copy and meaningful pane CTA behavior', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');

  assert.ok(js.includes('const V3_DECISION_CARD_COPY_MAP = Object.freeze({'));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.home.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.alerts.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.composer.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.monitor.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.readModel.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.cityPack.title'"));
  assert.ok(js.includes("titleKey: 'ui.label.v3.decision.emergencyLayer.title'"));
  assert.ok(js.includes('function syncV3DecisionCard(paneKey) {'));
  assert.ok(js.includes('syncV3DecisionCard(paneKey);'));
  assert.ok(js.includes("document.getElementById('users-filter-line-user-id')?.focus();"));
  assert.ok(js.includes("document.getElementById('users-summary-reload')?.click();"));
  assert.ok(js.includes("document.getElementById('city-pack-unified-reload')?.click();"));
  assert.ok(js.includes("document.getElementById('emergency-bulletin-reload')?.click();"));

  assert.ok(dict.includes('"ui.label.v3.decision.home.title": "最初にやることを決める"'));
  assert.ok(dict.includes('"ui.label.v3.decision.alerts.secondary": "一覧を更新する"'));
  assert.ok(dict.includes('"ui.label.v3.decision.composer.title": "送信内容を整える"'));
  assert.ok(dict.includes('"ui.label.v3.decision.monitor.secondary": "結果を更新する"'));
  assert.ok(dict.includes('"ui.label.v3.decision.readModel.primary": "会員を探す"'));
  assert.ok(dict.includes('"ui.label.v3.decision.cityPack.secondary": "候補を更新する"'));
  assert.ok(dict.includes('"ui.label.v3.decision.emergencyLayer.secondary": "受信箱を更新する"'));

  assert.ok(ssot.includes('## Ops First-View Noise Budget（Phase880 add-only）'));
  assert.ok(ssot.includes('## Home / Alerts Task-First Surface（Phase881 add-only）'));
  assert.ok(ssot.includes('`data-v3-ops-hidden="true"`'));
  assert.ok(ssot.includes('`data-v3-advanced-filter="true"`'));
});
