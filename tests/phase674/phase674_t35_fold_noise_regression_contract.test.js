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

function countOpenJsonDetails(section) {
  const matches = section.match(/<details\b(?=[^>]*\bopen\b)(?=[^>]*data-json-collapsible=\"true\")[^>]*>/g);
  return Array.isArray(matches) ? matches.length : 0;
}

test('phase674: target panes keep fold-noise baseline (open details do not increase)', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const monitorPane = extractPaneSection(html, 'monitor');
  const auditPane = extractPaneSection(html, 'audit');
  const llmPane = extractPaneSection(html, 'llm');
  const settingsPane = extractPaneSection(html, 'settings');

  assert.equal(countOpenJsonDetails(monitorPane), 0);
  assert.equal(countOpenJsonDetails(auditPane), 0);
  assert.equal(countOpenJsonDetails(settingsPane), 0);
  assert.equal(countOpenJsonDetails(llmPane), 1);
});

test('phase674: monitor/audit/llm/settings keep evidence placeholders under collapsible blocks', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const monitorPane = extractPaneSection(html, 'monitor');
  const auditPane = extractPaneSection(html, 'audit');
  const llmPane = extractPaneSection(html, 'llm');
  const settingsPane = extractPaneSection(html, 'settings');

  assert.match(monitorPane, /<details[^>]*data-json-collapsible="true"[^>]*>\s*<summary[^>]*>RAW JSON<\/summary>/m);
  assert.match(auditPane, /<details class="section" data-json-collapsible="true">\s*<summary[^>]*>監査結果（JSON）<\/summary>/m);
  assert.match(llmPane, /<details class="section" open data-json-collapsible="true">\s*<summary[^>]*>Ops説明<\/summary>/m);
  assert.match(settingsPane, /<details class="section" data-json-collapsible="true">\s*<summary>Journey Policy（status）<\/summary>/m);
});
