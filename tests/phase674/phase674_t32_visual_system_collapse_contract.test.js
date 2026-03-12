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

test('phase674: visual cleanup marks monitor/audit/settings/llm evidence blocks as json-collapsible', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const monitorPane = extractPaneSection(html, 'monitor');
  const auditPane = extractPaneSection(html, 'audit');
  const llmPane = extractPaneSection(html, 'llm');
  const settingsPane = extractPaneSection(html, 'settings');

  assert.match(monitorPane, /<details[^>]*data-json-collapsible="true"[^>]*>\s*<summary[^>]*>RAW JSON<\/summary>/m);
  assert.match(monitorPane, /<pre id="monitor-raw"[^>]*data-visual-noise="evidence-placeholder"/m);

  assert.match(auditPane, /<pre id="audit-result"[^>]*data-visual-noise="evidence-placeholder"/m);
  assert.match(auditPane, /<pre id="audit-detail"[^>]*data-visual-noise="evidence-placeholder"/m);
  assert.match(auditPane, /<details class="section" data-json-collapsible="true">\s*<summary[^>]*>実行結果<\/summary>/m);

  assert.match(llmPane, /<details class="section" open data-json-collapsible="true">\s*<summary[^>]*>Ops説明<\/summary>/m);
  assert.match(llmPane, /<pre id="llm-config-set-result"[^>]*data-visual-noise="evidence-placeholder"/m);
  assert.match(llmPane, /<details class="section" data-json-collapsible="true">\s*<summary>LLM usage集計（JSON）<\/summary>/m);

  assert.match(settingsPane, /<details class="section" data-json-collapsible="true">\s*<summary>Journey Policy（status）<\/summary>/m);
  assert.match(settingsPane, /<pre id="ux-policy-fatigue-warning"[^>]*data-visual-noise="evidence-placeholder"/m);
});

test('phase674: ADMIN_NO_COLLAPSE_V1 keeps global no-collapse while allowing json-collapsible exceptions', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(js.includes('const ADMIN_NO_COLLAPSE_V1 = resolveFrontendFeatureFlag('));
  assert.ok(js.includes('function isJsonCollapsibleDetail(el) {'));
  assert.ok(js.includes('if (isJsonCollapsibleDetail(el)) {'));
  assert.ok(js.includes("document.querySelectorAll('details[data-json-collapsible=\"true\"]').forEach((el) => {"));
  assert.ok(js.includes("el.setAttribute('data-visual-noise', 'evidence-placeholder');"));
  assert.ok(js.includes("el.removeAttribute('data-visual-noise');"));

  assert.ok(css.includes('details[data-json-collapsible="true"] > summary'));
  assert.ok(css.includes('pre[data-visual-noise="evidence-placeholder"]'));
});
