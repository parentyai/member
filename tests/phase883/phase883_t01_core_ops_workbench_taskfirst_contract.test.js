'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

test('phase883: composer, monitor, and errors stay task-first in ops shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');

  assert.ok(html.includes('id="composer-task-summary"'));
  assert.ok(html.includes('id="monitor-task-summary"'));
  assert.ok(html.includes('id="errors-task-summary"'));
  assert.ok(html.includes('id="monitor-pane-details" class="decision-details section" data-surface-tier="primary" open'));
  assert.ok(html.includes('id="errors-pane-details" class="decision-details section" open'));
  assert.ok(html.includes('id="errors-summary-details" class="table-section section" data-json-collapsible="true" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('id="composer-trigger-order-note" class="note" data-v3-ops-hidden="true"'));
  assert.ok(html.includes('data-ui="composer-scenario-step-overview" data-v3-ops-hidden="true"'));

  assert.ok(js.includes('function resolveComposerTaskSummary() {'));
  assert.ok(js.includes('function renderComposerTaskSummary() {'));
  assert.ok(js.includes('function resolveMonitorTaskSummary() {'));
  assert.ok(js.includes('function renderMonitorTaskSummary() {'));
  assert.ok(js.includes('function resolveErrorsTaskSummary() {'));
  assert.ok(js.includes('function renderErrorsTaskSummary() {'));
  assert.ok(js.includes("const currentActionId = resolveComposerCurrentPrimaryAction(state.composerActionGateState);"));
  assert.ok(js.includes("(document.getElementById('monitor-toolbar-status') || document.getElementById('monitor-toolbar-query') || document.getElementById('monitor-reload'))?.focus();"));
  assert.ok(js.includes("activatePane('maintenance');"));
  assert.ok(js.includes("renderDecisionCard('errors', resolveErrorsDecisionVm());"));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.composer.prioritySummary',
    'ui.label.monitor.prioritySummary',
    'ui.label.errors.prioritySummary',
    'ui.desc.page.composer',
    'ui.desc.page.monitor',
    'ui.desc.page.errors',
  ]);

  assert.ok(ssot.includes('## Composer / Monitor / Errors Task-First Workbench（Phase883 add-only）'));
  assert.ok(runbook.includes('## Monitor Flow（配信結果の確認）'));
  assert.ok(runbook.includes('## Errors Flow（異常の切り分け）'));
});
