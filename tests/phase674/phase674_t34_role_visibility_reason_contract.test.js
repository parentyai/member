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

test('phase674: target panes expose role/rollout visibility reasons in UI copy', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const monitorPane = extractPaneSection(html, 'monitor');
  const auditPane = extractPaneSection(html, 'audit');
  const llmPane = extractPaneSection(html, 'llm');
  const settingsPane = extractPaneSection(html, 'settings');

  assert.ok(monitorPane.includes('id="monitor-role-visibility-reason"'));
  assert.ok(monitorPane.includes('id="monitor-insights-handoff-reason"'));
  assert.ok(auditPane.includes('id="audit-role-visibility-reason"'));
  assert.ok(llmPane.includes('id="llm-role-visibility-reason"'));
  assert.ok(llmPane.includes('id="llm-rollout-visibility-reason"'));
  assert.ok(settingsPane.includes('id="settings-role-visibility-reason"'));

  assert.ok(monitorPane.includes('data-ui="role-visibility-reason"'));
  assert.ok(auditPane.includes('data-ui="role-visibility-reason"'));
  assert.ok(llmPane.includes('data-ui="role-visibility-reason"'));
  assert.ok(settingsPane.includes('data-ui="role-visibility-reason"'));
});

test('phase674: runtime updates visibility reasons and blocked-pane explanation wiring', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('function renderPaneVisibilityReasons() {'));
  assert.ok(js.includes('function setRoleVisibilityReasonText(elementId, message) {'));
  assert.ok(js.includes("'monitor-role-visibility-reason'"));
  assert.ok(js.includes("'audit-role-visibility-reason'"));
  assert.ok(js.includes("'llm-role-visibility-reason'"));
  assert.ok(js.includes("'settings-role-visibility-reason'"));

  assert.ok(js.includes('requestedPane: normalizedTarget'));
  assert.ok(js.includes('requestedPane: paneKey'));
  assert.ok(js.includes('resolveRoleScopeLabel(currentRole)'));
  assert.ok(js.includes('state.llmRolloutStage = qualityLoopV2.rolloutStage || null;'));
  assert.ok(js.includes('state.monitorDiagnosticsReason = noteText;'));
});
