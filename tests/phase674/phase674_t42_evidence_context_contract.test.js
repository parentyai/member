'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  loadAdminUiDictionaryMap,
  assertDictionaryHasTextKeys,
} = require('../_admin_ui_dictionary_test_helper');

function extractPaneSection(html, paneId) {
  const marker = `<section id="pane-${paneId}"`;
  const start = html.indexOf(marker);
  if (start === -1) return '';
  const next = html.indexOf('<section id="pane-', start + marker.length);
  return next === -1 ? html.slice(start) : html.slice(start, next);
}

test('phase674: audit pane keeps source context block and return action for evidence separation', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const auditPane = extractPaneSection(html, 'audit');

  assert.ok(auditPane.includes('id="audit-entry-context"'));
  assert.ok(auditPane.includes('id="audit-entry-source"'));
  assert.ok(auditPane.includes('id="audit-entry-trace"'));
  assert.ok(auditPane.includes('id="audit-open-source"'));
});

test('phase674: evidence navigation stores source-pane context before opening audit', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dictMap = loadAdminUiDictionaryMap();

  assert.ok(js.includes('function resolveAuditSourceMeta(sourcePane) {'));
  assert.ok(js.includes('function renderAuditEntryContext(traceId) {'));
  assert.ok(js.includes('async function openAuditFromSource(sourcePane, traceId, options = {}) {'));
  assert.ok(js.includes("activatePane('audit', { historyMode: options.historyMode || 'push', preserveAuditContext: true });"));
  assert.ok(js.includes("document.getElementById('audit-open-source')?.addEventListener('click', () => {"));
  assert.ok(js.includes("await openAuditFromSource('composer', traceId, { historyMode: 'push' }).catch(() => {"));
  assert.ok(js.includes("void openAuditFromSource('monitor', traceId, { historyMode: 'push' }).catch(() => {"));

  assert.ok(css.includes('.audit-entry-context {'));
  assert.ok(css.includes('.audit-entry-meta {'));
  assert.ok(css.includes('.audit-entry-actions {'));

  assertDictionaryHasTextKeys(dictMap, [
    'ui.label.audit.entryContext',
    'ui.desc.audit.boundaryDefault',
  ]);
});
