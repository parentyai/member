'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: monitor list exposes table toolbar + saved view controls', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="monitor-saved-view"'));
  assert.ok(html.includes('id="monitor-toolbar-query"'));
  assert.ok(html.includes('id="monitor-toolbar-status"'));
  assert.ok(html.includes('id="monitor-global-reload"'));
  assert.ok(html.includes('class="pane-detail" data-monitor-surface="monitoring"'));
});

test('phase674: monitor runtime applies saved-view filtering and list-detail selection contract', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes('function normalizeMonitorSavedView(value)'));
  assert.ok(js.includes('function resolveMonitorVisibleItems(items)'));
  assert.ok(js.includes('function renderMonitorDetail(item)'));
  assert.ok(js.includes('function selectMonitorRow(tbody, rowEl, item, options)'));
  assert.ok(js.includes("document.getElementById('monitor-saved-view')?.addEventListener('change'"));
  assert.ok(js.includes("document.getElementById('monitor-toolbar-query')?.addEventListener('input'"));
  assert.ok(js.includes("document.getElementById('monitor-toolbar-status')?.addEventListener('change'"));
});

test('phase674: monitor table toolbar styles and two-column detail rail layout are declared', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.monitor-table-toolbar'));
  assert.ok(css.includes('#pane-monitor .pane-grid'));
  assert.ok(css.includes('#pane-monitor .pane-actions'));
});
