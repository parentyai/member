'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase883: composer, monitor, and errors stay task-first in ops shell', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
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

  assert.ok(dict.includes('"ui.label.composer.prioritySummary": "最初に確認すること"'));
  assert.ok(dict.includes('"ui.label.monitor.prioritySummary": "最初に確認すること"'));
  assert.ok(dict.includes('"ui.label.errors.prioritySummary": "最初に確認すること"'));
  assert.ok(dict.includes('"ui.desc.page.composer": "本文と対象を整え、次の操作を1つずつ進めます。"'));
  assert.ok(dict.includes('"ui.desc.page.monitor": "危険や注意のある配信から確認し、必要な通知だけ詳しく見ます。"'));
  assert.ok(dict.includes('"ui.desc.page.errors": "危険リンクと再送待ちを見分けて、次の対応先へ進みます。"'));

  assert.ok(ssot.includes('## Composer / Monitor / Errors Task-First Workbench（Phase883 add-only）'));
  assert.ok(runbook.includes('## Monitor Flow（配信結果の確認）'));
  assert.ok(runbook.includes('## Errors Flow（異常の切り分け）'));
});
