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

test('phase674: llm pane exposes v2 workspace modes and surfaces', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const llmPane = extractPaneSection(html, 'llm');

  assert.match(llmPane, /data-pane-mode="llm-workspace"/);
  assert.match(llmPane, /id="llm-workspace-card"/);
  assert.match(llmPane, /id="llm-view-run"[^>]*data-llm-view-target="run"/);
  assert.match(llmPane, /id="llm-view-control"[^>]*data-llm-view-target="control"/);
  assert.match(llmPane, /id="llm-view-quality"[^>]*data-llm-view-target="quality"/);
  assert.match(llmPane, /id="llm-view-note"/);
  assert.match(llmPane, /data-llm-surface="run"/);
  assert.match(llmPane, /data-llm-surface="control"/);
  assert.match(llmPane, /data-llm-surface="quality"/);
  assert.match(llmPane, /id="llm-quality-panel"/);
  assert.match(llmPane, /id="llm-run-faq"[^>]*data-llm-primary-for="run"[^>]*data-primary-action="pane-primary"/);
  assert.match(llmPane, /id="llm-policy-plan"[^>]*data-llm-primary-for="control"/);
  assert.match(llmPane, /id="llm-usage-summary-reload"[^>]*data-llm-primary-for="quality"/);
});

test('phase674: llm workspace view sync keeps URL state and lazy loads non-run surfaces', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes("function normalizeLlmWorkspaceView(view) {"));
  assert.ok(js.includes("function resolveLlmWorkspaceViewFromLocation() {"));
  assert.ok(js.includes("function primeLlmWorkspaceView(view) {"));
  assert.ok(js.includes("function applyLlmWorkspaceView(view, options) {"));
  assert.ok(js.includes("currentUrl.searchParams.get('view')"));
  assert.ok(js.includes("urlObj.searchParams.set('view', nextView)"));
  assert.ok(js.includes("urlObj.searchParams.delete('view')"));
  assert.ok(js.includes("document.querySelectorAll('[data-llm-view-target]')"));
  assert.ok(js.includes("loadLlmConfigStatus().catch(() => {})"));
  assert.ok(js.includes("loadLlmPolicyStatus({ notify: false }).catch(() => {})"));
  assert.ok(js.includes("loadLlmPolicyHistory({ notify: false }).catch(() => {})"));
  assert.ok(js.includes("loadLlmUsageSummary({ notify: false }).catch(() => {})"));
  assert.ok(js.includes("updateHistoryWithPaneRole('llm', state.role, opts.historyMode || 'replace')"));
});
