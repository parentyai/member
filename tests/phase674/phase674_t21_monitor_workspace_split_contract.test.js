'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: monitor pane provides monitoring/configuration workspace switch contract', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="monitor-view-monitoring"'));
  assert.ok(html.includes('id="monitor-view-configuration"'));
  assert.ok(html.includes('data-monitor-view-target="monitoring"'));
  assert.ok(html.includes('data-monitor-view-target="configuration"'));
  assert.ok(html.includes('data-role-allow="admin,developer"'));
  assert.ok(html.includes('id="monitor-view-permission-notice"'));

  assert.ok(html.includes('id="monitor-journey-panel" class="panel" data-monitor-surface="configuration"'));
  assert.ok(html.includes('id="monitor-rich-menu-panel" data-monitor-surface="configuration"'));
  assert.ok(html.includes('data-monitor-surface="monitoring"'));
});

test('phase674: monitor workspace split is role-aware and applied by runtime controller', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(js.includes('const MONITOR_WORKSPACE_VIEW_MONITORING = \'monitoring\';'));
  assert.ok(js.includes('const MONITOR_WORKSPACE_VIEW_CONFIGURATION = \'configuration\';'));
  assert.ok(js.includes('function canUseMonitorConfigurationView(role)'));
  assert.ok(js.includes('function applyMonitorWorkspaceView(view, options)'));
  assert.ok(js.includes('document.querySelectorAll(\'[data-monitor-view-target]\')'));
  assert.ok(js.includes('buttonEl.id === \'monitor-view-configuration\''));
  assert.ok(js.includes('buttonEl.classList.remove(\'role-hidden\');'));
  assert.ok(js.includes('permissionNoticeEl.classList.toggle(\'is-hidden\', canUseConfiguration);'));
  assert.ok(js.includes('applyMonitorWorkspaceView(state.monitorWorkspaceView, { persist: true });'));

  assert.ok(css.includes('.monitor-view-switch'));
  assert.ok(css.includes('.monitor-view-btn.is-active'));
  assert.ok(css.includes('#monitor-view-configuration.role-hidden'));
  assert.ok(css.includes('#monitor-view-configuration[disabled]'));
  assert.ok(css.includes('#pane-monitor .pane-grid'));
  assert.ok(css.includes('#pane-monitor[data-monitor-workspace-view="monitoring"] [data-monitor-surface="configuration"]'));
});
