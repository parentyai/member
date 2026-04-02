'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase888: operator walkthrough polish keeps ops first-view task-first', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');

  assert.ok(html.includes('class="topbar-v3-secondary"'));
  assert.ok(html.includes('data-dict-key="ui.desc.v3.top.role"'));
  assert.ok(html.includes('id="composer-pane-details" class="decision-details section" data-workbench-zone="true" data-workbench-collapsible="true" data-surface-tier="primary"'));
  assert.ok(html.includes('id="monitor-pane-details" class="decision-details section" data-workbench-collapsible="true" data-surface-tier="primary"'));
  assert.ok(html.includes('id="errors-pane-details" class="decision-details section" data-workbench-collapsible="true"'));
  assert.ok(html.includes('id="emergency-layer-pane-details" class="decision-details section" data-workbench-zone="true" data-workbench-collapsible="true"'));
  assert.ok(html.includes('data-users-quick-filter="all">すべて</button>'));
  assert.ok(html.includes('data-users-sort-key="lineUserId">確認する会員</button>'));
  assert.ok(html.includes('id="users-summary-analyze-result" class="note">傾向表示はまだありません。</div>'));

  assert.ok(js.includes('const USERS_SUMMARY_OPS_COLUMN_KEYS = Object.freeze(['));
  assert.ok(js.includes("const OPS_DENSE_DETAIL_PANES = new Set(['composer', 'monitor', 'errors', 'emergency-layer']);"));
  assert.ok(js.includes('function shouldAutoOpenDecisionDetails(paneKey, vm) {'));
  assert.ok(js.includes('function createUsersSummaryLeadCell(item) {'));
  assert.ok(js.includes("all: 'すべて'"));

  assert.ok(css.includes('.topbar-v3-secondary {'));
  assert.ok(css.includes('.users-lead-cell {'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.v3.top.role',
    'ui.desc.v3.top.role',
    'ui.label.page.emergencyLayer',
  ]);
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.ok(dict.includes('## Operator Walkthrough Copy Policy（Phase888 add-only）'));

  assert.ok(ssot.includes('## Operator Walkthrough Polish（Phase888 add-only）'));
  assert.ok(runbook.includes('## Operator Walkthrough（Phase888）'));
  assert.ok(runbook.includes('## Browser Validation Fallback（Phase888）'));
});
