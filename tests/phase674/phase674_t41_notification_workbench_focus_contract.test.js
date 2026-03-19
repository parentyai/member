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

test('phase674: composer workbench keeps explicit next-step guidance and guarded preview trigger', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const dict = fs.readFileSync('docs/ADMIN_UI_DICTIONARY_JA.md', 'utf8');
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  const composerPane = extractPaneSection(html, 'composer');
  assert.ok(composerPane.includes('id="composer-next-step"'));
  assert.ok(composerPane.includes('id="composer-preview-trigger"'));
  assert.ok(composerPane.includes('data-composer-preview-trigger="true"'));

  assert.ok(js.includes('function renderComposerNextStep(gateState) {'));
  assert.ok(js.includes("mapping.mirrorId === 'composer-card-preview' && !event.target.closest('[data-composer-preview-trigger=\"true\"]')"));
  assert.ok(js.includes('renderComposerNextStep(gateState);'));
  assert.ok(js.includes('applyComposerActionGateState(gateState);'));

  assert.ok(dict.includes('"ui.label.composer.nextStep"'));
  assert.ok(dict.includes('"ui.desc.composer.nextStep.createDraft"'));
  assert.ok(dict.includes('"ui.desc.composer.nextStep.execute"'));
  assert.ok(dict.includes('"ui.desc.composer.nextStep.reviewEvidence"'));

  assert.ok(css.includes('#pane-composer .composer-card-actions .composer-hidden-action'));
  assert.ok(css.includes('#pane-composer .composer-status-wrap {'));
  assert.ok(css.includes('#pane-composer .composer-main-layout {'));
});
