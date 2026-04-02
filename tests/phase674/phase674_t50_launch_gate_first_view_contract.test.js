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

test('phase674: launch gate keeps composer primary action rail above the form body', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const composerPane = extractPaneSection(html, 'composer');
  const actionRailIndex = composerPane.indexOf('<div class="composer-action-rail" data-ui="composer-action-rail">');
  const inputGridIndex = composerPane.indexOf('<div class="input-grid">');
  assert.ok(actionRailIndex !== -1, 'composer action rail should exist');
  assert.ok(inputGridIndex !== -1, 'composer input grid should exist');
  assert.ok(actionRailIndex < inputGridIndex, 'composer action rail should appear before the form input grid');
});

test('phase674: launch gate keeps errors pane action-first and collapses summary payload', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const errorsPane = extractPaneSection(html, 'errors');
  assert.match(errorsPane, /<button id="errors-to-ops"[^>]*data-primary-action="pane-primary"[^>]*>/);
  assert.match(errorsPane, /<details id="errors-summary-details" class="table-section section" data-json-collapsible="true" data-v3-ops-hidden="true">\s*<summary[^>]*>[^<]+<\/summary>\s*<pre id="errors-summary"[^>]*data-visual-noise="evidence-placeholder"/m);
  assert.doesNotMatch(errorsPane, /<details class="table-section section" open>/);
});

test('phase674: launch gate demotes vendor raw payloads below fold noise surfaces', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const vendorsPane = extractPaneSection(html, 'vendors');
  assert.match(vendorsPane, /<div id="vendor-shadow-summary" class="note vendor-shadow-summary">-<\/div>/);
  assert.doesNotMatch(vendorsPane, /<pre id="vendor-shadow-summary">/);
  assert.match(vendorsPane, /<details data-json-collapsible="true">\s*<summary>RAW JSON<\/summary>\s*<pre id="vendor-shadow-raw"[^>]*data-visual-noise="evidence-placeholder"/m);
  assert.match(vendorsPane, /<details data-json-collapsible="true">\s*<summary[^>]*>RAW JSON<\/summary>\s*<pre id="vendor-raw"[^>]*data-visual-noise="evidence-placeholder"/m);
});

test('phase674: launch gate localizes struct drift primary actions for system recovery', () => {
  const dictionary = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  assert.match(dictionary, /"ui\.label\.structDrift\.runDry": "ドライラン"/);
  assert.match(dictionary, /"ui\.label\.structDrift\.runApply": "適用"/);
  assert.doesNotMatch(dictionary, /"ui\.label\.structDrift\.runDry": "Dry Run"/);
  assert.doesNotMatch(dictionary, /"ui\.label\.structDrift\.runApply": "Apply"/);
});
