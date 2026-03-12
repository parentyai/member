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

test('phase674: composer separates evidence payload from always-on workbench surface', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const composerPane = extractPaneSection(html, 'composer');

  assert.ok(composerPane.includes('id="composer-open-audit"'));
  assert.ok(composerPane.includes('id="composer-open-trace-monitor"'));
  assert.ok(composerPane.includes('data-ui="composer-evidence-nav"'));
  assert.ok(composerPane.includes('証跡確認は Evidence 画面で行います'));

  const hiddenEvidencePattern = /id="composer-evidence-inline"[^>]*hidden[^>]*aria-hidden="true"/m;
  assert.match(composerPane, hiddenEvidencePattern);
});

test('phase674: audit pane defines evidence boundary and one-click transitions', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const auditPane = extractPaneSection(html, 'audit');

  assert.ok(auditPane.includes('Evidence Hub（trace / audit / decision timeline）'));
  assert.ok(auditPane.includes('id="audit-open-monitor"'));
  assert.ok(auditPane.includes('id="audit-open-composer"'));
  assert.ok(auditPane.includes('Decision Timeline / 詳細'));

  const monitorPane = extractPaneSection(html, 'monitor');
  assert.ok(monitorPane.includes('id="monitor-open-audit-from-detail"'));
});

test('phase674: runtime binds evidence navigation contract without altering write routes', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('async function navigateToAuditWithTrace(traceId, options = {})'));
  assert.ok(js.includes('function resolveEvidenceTraceId(traceId)'));
  assert.ok(js.includes("await navigateToAuditWithTrace(traceId, { historyMode: 'push' }).catch(() => {"));
  assert.ok(js.includes("document.getElementById('audit-open-monitor')?.addEventListener('click', () => {"));
  assert.ok(js.includes("document.getElementById('monitor-open-audit-from-detail')?.addEventListener('click', openAuditFromMonitor);"));
  assert.ok(js.includes("document.getElementById('monitor-open-trace')?.addEventListener('click', openAuditFromMonitor);"));

  assert.ok(js.includes("postJson('/api/admin/os/notifications/send/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/notifications/send/execute'"));
});
