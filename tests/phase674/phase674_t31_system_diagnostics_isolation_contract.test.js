'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: monitor pane keeps diagnostics handoff and hides inline diagnostics panel', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="monitor-open-system-diagnostics"'));
  assert.ok(html.includes('id="monitor-insights-system-handoff"'));
  assert.ok(html.includes('id="monitor-insights-diagnostics-panel" class="panel is-hidden"'));
});

test('phase674: local preflight recovery action routes to system health pane', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes("activatePane('ops-system-health', { historyMode: 'push', syncHistory: true });"));
  assert.ok(src.includes('function syncSystemDiagnosticsVisibility()'));
  assert.ok(src.includes('syncSystemDiagnosticsVisibility();'));
  assert.ok(src.includes("const SYSTEM_DIAGNOSTIC_PANES = new Set(["));
});
