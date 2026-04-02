'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function assertOrderedSections(html, paneId) {
  const start = html.indexOf(`id="${paneId}"`);
  assert.notEqual(start, -1, `${paneId} missing`);
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, `${paneId} closing section missing`);
  const chunk = html.slice(start, end);
  const overview = chunk.indexOf('data-console-section="overview"');
  const warnings = chunk.indexOf('data-console-section="warnings"');
  const actions = chunk.indexOf('data-console-section="actions"');
  const details = chunk.indexOf('data-console-section="details"');
  const raw = chunk.indexOf('data-console-section="raw"');
  assert.ok(overview !== -1 && warnings !== -1 && details !== -1 && actions !== -1 && raw !== -1, `${paneId} missing console sections`);
  assert.ok(overview < warnings, `${paneId} overview should come before warnings`);
  assert.ok(warnings < actions, `${paneId} warnings should come before actions`);
  assert.ok(actions < details, `${paneId} actions should come before details`);
  assert.ok(actions < raw, `${paneId} actions should come before raw`);
}

test('phase888: system console panes expose ordered overview-warnings-actions-details-raw hierarchy', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(html.includes('id="pane-ops-feature-catalog" class="app-pane" data-pane="ops-feature-catalog"'));
  assert.ok(html.includes('id="pane-ops-system-health" class="app-pane" data-pane="ops-system-health"'));
  assert.ok(html.includes('data-console-pane="true"'));
  assertOrderedSections(html, 'pane-ops-feature-catalog');
  assertOrderedSections(html, 'pane-ops-system-health');

  assert.ok(js.includes("const SYSTEM_CONSOLE_SECTION_ORDER = Object.freeze(['overview', 'warnings', 'actions', 'details', 'raw']);"));
  assert.ok(js.includes('function applySystemConsoleHierarchy() {'));

  assert.ok(css.includes('.console-section-panel {'));
  assert.ok(css.includes('[data-console-pane="true"] .pane-detail {'));
});
