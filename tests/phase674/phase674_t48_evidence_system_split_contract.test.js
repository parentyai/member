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

test('phase674: errors pane presents handoff-only actions for evidence and recovery', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const errorsPane = extractPaneSection(html, 'errors');

  assert.ok(errorsPane.includes('data-pane-mode="evidence-review"'));
  assert.ok(errorsPane.includes('data-dict-key="ui.label.errors.action.monitor"'));
  assert.ok(errorsPane.includes('data-dict-key="ui.label.errors.action.audit"'));
  assert.ok(errorsPane.includes('data-dict-key="ui.label.errors.action.system"'));
  assert.ok(errorsPane.includes('data-dict-key="ui.desc.errors.handoff"'));
  assert.ok(errorsPane.includes('id="errors-to-ops"'));
  assert.ok(js.includes("document.getElementById('errors-to-ops')?.addEventListener('click', () => {"));
  assert.ok(js.includes("activatePane('maintenance');"));
  assert.ok(js.includes("document.getElementById('errors-action-activate')?.addEventListener('click', () => {"));
  assert.ok(js.includes("const summary = resolveErrorsTaskSummary();"));
  assert.ok(js.includes("if (summary.warnLinks > 0) {"));
  assert.ok(js.includes("activatePane('monitor');"));
  assert.ok(js.includes("document.getElementById('errors-action-disable')?.addEventListener('click', () => {"));
});

test('phase674: audit pane stays evidence-only while system pane owns corrective actions', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const auditPane = extractPaneSection(html, 'audit');
  const maintenancePane = extractPaneSection(html, 'maintenance');

  assert.ok(auditPane.includes('data-ui="audit-system-handoff"'));
  assert.ok(auditPane.includes('id="audit-open-maintenance"'));
  assert.ok(auditPane.includes('id="audit-open-system-health"'));
  assert.ok(!auditPane.includes('struct-drift-run-dry'));
  assert.ok(!auditPane.includes('struct-drift-run-apply'));
  assert.ok(maintenancePane.includes('data-ui="maintenance-struct-drift-panel"'));
  assert.ok(maintenancePane.includes('id="struct-drift-run-dry"'));
  assert.ok(maintenancePane.includes('id="struct-drift-run-apply"'));
});
