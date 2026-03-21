'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: v2 foundation adds semantic shell and pane surface markers', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const homePane = extractPaneSection(html, 'home');
  const composerPane = extractPaneSection(html, 'composer');
  const monitorPane = extractPaneSection(html, 'monitor');
  const cityPackPane = extractPaneSection(html, 'city-pack');
  const vendorsPane = extractPaneSection(html, 'vendors');
  const auditPane = extractPaneSection(html, 'audit');
  const llmPane = extractPaneSection(html, 'llm');

  assert.match(html, /id="app-shell"[^>]*data-ui-v2-foundation="true"[^>]*data-surface-tier="shell"/);
  assert.match(html, /<aside class="app-nav"[^>]*data-surface-tier="navigation"/);
  assert.match(html, /<header class="app-topbar"[^>]*data-surface-tier="chrome"/);
  assert.match(html, /<section class="page-header"[^>]*data-surface-tier="context"[^>]*data-pane-mode="decision-console"/);
  assert.ok(html.includes('id="page-task-context"'));
  assert.match(html, /id="page-action-primary"[^>]*data-primary-action="page-primary"/);

  assert.match(homePane, /data-pane-mode="decision-console"/);
  assert.match(homePane, /id="home-decision-card"[^>]*data-surface-tier="hero"/);
  assert.match(homePane, /id="home-reflection-reason"[^>]*data-empty-reason="home-reflection"/);
  assert.match(homePane, /id="home-reflection-next"[^>]*data-next-action="home-reflection"/);
  assert.match(homePane, /class="panel dashboard-focus-panel"[^>]*data-surface-tier="primary"/);
  assert.match(homePane, /class="panel dashboard-panel dashboard-panel-detail"[^>]*data-surface-tier="secondary"/);

  assert.match(composerPane, /data-pane-mode="notification-workbench"/);
  assert.match(composerPane, /id="composer-inputs"[^>]*data-surface-tier="primary"/);
  assert.match(composerPane, /id="composer-card-preview"[^>]*data-surface-tier="secondary"/);
  assert.match(composerPane, /id="composer-saved-panel"[^>]*data-surface-tier="secondary"/);

  assert.match(monitorPane, /data-pane-mode="data-workspace"/);
  assert.match(monitorPane, /id="monitor-reflection-reason"[^>]*data-empty-reason="monitor-reflection"/);
  assert.match(monitorPane, /id="monitor-reflection-next"[^>]*data-next-action="monitor-reflection"/);
  assert.match(monitorPane, /class="pane-detail"[^>]*data-detail-rail="detail"/);

  assert.match(cityPackPane, /data-task-context="city-pack-operations"/);
  assert.match(cityPackPane, /id="city-pack-v2-detail-panel"[^>]*data-detail-rail="relation"/);
  assert.match(vendorsPane, /id="vendor-unified-relation-panel"[^>]*data-detail-rail="relation"/);
  assert.match(auditPane, /data-pane-mode="evidence-review"/);
  assert.match(llmPane, /data-pane-mode="llm-workspace"/);
});

test('phase674: v2 foundation syncs pane metadata through page header state', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const docs = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  assert.ok(js.includes('const PANE_V2_META = Object.freeze({'));
  assert.ok(js.includes("home: Object.freeze({ paneMode: 'decision-console'"));
  assert.ok(js.includes("composer: Object.freeze({ paneMode: 'notification-workbench'"));
  assert.ok(js.includes("monitor: Object.freeze({ paneMode: 'data-workspace'"));
  assert.ok(js.includes("llm: Object.freeze({ paneMode: 'llm-workspace'"));
  assert.ok(js.includes('function syncPaneV2Metadata(paneKey) {'));
  assert.ok(js.includes('taskContextEl.textContent = t(meta.taskContextKey, meta.taskContextFallback);'));
  assert.ok(js.includes('pageHeader.dataset.paneMode = meta.paneMode;'));
  assert.ok(js.includes('appShell.dataset.taskContext = meta.taskContext;'));
  assert.ok(js.includes('syncPaneV2Metadata(paneKey);'));

  assert.ok(docs.includes('"ui.label.v2.task.todayJudgment": "今日の判断を進める"'));
  assert.ok(docs.includes('"ui.label.v2.task.notificationExecution": "通知の作成から実行まで進める"'));
  assert.ok(docs.includes('"ui.label.v2.task.deliveryMonitoring": "配信結果と反応を確認する"'));
  assert.ok(docs.includes('"ui.label.v2.task.llmOperations": "LLM運用を役割ごとに進める"'));
});

test('phase674: v2 foundation adds semantic visual tokens and tier rules', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('--surface-0: #edf2f6;'));
  assert.ok(css.includes('--surface-1: #ffffff;'));
  assert.ok(css.includes('--surface-3: #f7f4ee;'));
  assert.ok(css.includes('--text-strong: #0f1728;'));
  assert.ok(css.includes('--accent-primary: #2a56c7;'));
  assert.ok(css.includes('--space-8: 40px;'));
  assert.ok(css.includes('[data-ui-v2-foundation="true"] [data-surface-tier="hero"]'));
  assert.ok(css.includes('[data-ui-v2-foundation="true"] [data-surface-tier="primary"]'));
  assert.ok(css.includes('[data-ui-v2-foundation="true"] [data-surface-tier="secondary"]'));
  assert.ok(css.includes('[data-ui-v2-foundation="true"] [data-detail-rail]'));
  assert.ok(css.includes('.page-task-context {'));
});
