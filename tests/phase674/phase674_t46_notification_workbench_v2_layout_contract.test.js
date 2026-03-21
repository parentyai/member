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

test('phase674: composer workbench v2 keeps a single visible primary action rail and secondary rails', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');

  const composerPane = extractPaneSection(html, 'composer');
  assert.ok(composerPane.includes('data-ui="composer-workbench-layout"'));
  assert.ok(composerPane.includes('data-ui="composer-action-rail"'));
  assert.ok(composerPane.includes('id="composer-current-action-note"'));
  assert.ok(composerPane.includes('id="composer-saved-panel"'));
  assert.ok(composerPane.includes('data-detail-rail="composer-saved-library"'));
  assert.ok(composerPane.includes('id="composer-saved-table-wrap"'));
  assert.ok(composerPane.includes('id="composer-secondary-cta-fields"'));
  assert.ok(composerPane.includes('data-workbench-collapsible="true"'));
  assert.ok(composerPane.includes('id="composer-scenario-step-matrix"'));

  assert.ok(js.includes('function isWorkbenchCollapsibleDetail(el) {'));
  assert.ok(js.includes('function resolveComposerCurrentPrimaryAction(gateState) {'));
  assert.ok(js.includes('function renderComposerCurrentActionRail(gateState) {'));
  assert.ok(js.includes('function renderComposerSavedSelectionNote() {'));
  assert.ok(js.includes('function syncComposerOptionalSections() {'));
  assert.ok(js.includes('renderComposerCurrentActionRail(gateState);'));

  assert.ok(css.includes('#pane-composer .composer-action-rail {'));
  assert.ok(css.includes('#pane-composer .composer-saved-table-wrap {'));
  assert.ok(css.includes('#pane-composer details[data-workbench-collapsible="true"] > summary {'));
  assert.ok(css.includes('#pane-composer .composer-card-actions > button.is-current-primary {'));

  assert.ok(dict.includes('"ui.label.composer.currentAction"'));
  assert.ok(dict.includes('"ui.label.composer.secondaryOptions"'));
  assert.ok(dict.includes('"ui.desc.composer.saved.selectionIdle"'));
  assert.ok(dict.includes('"ui.desc.composer.saved.matrix"'));
});
