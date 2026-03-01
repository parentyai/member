'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function extractBlock(source, marker, endMarker) {
  const start = source.indexOf(marker);
  if (start === -1) return '';
  const end = source.indexOf(endMarker, start);
  if (end === -1) return source.slice(start);
  return source.slice(start, end);
}

test('phase272: composer category wizard keeps unified action rail and add-only anchors', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="composer-category-wizard"'));
  assert.ok(html.includes('id="composer-category-summary"'));
  assert.ok(html.includes('id="composer-category-steps"'));
  assert.ok(html.includes('id="composer-category-required"'));
  assert.ok(html.includes('id="composer-category-next"'));
  assert.ok(html.includes('id="composer-link-search"'));

  const actionRail = extractBlock(html, '<div class="composer-primary-actions">', '</div>');
  assert.ok(actionRail.includes('id="create-draft"'));
  assert.ok(actionRail.includes('id="preview"'));
  assert.ok(actionRail.includes('id="approve"'));
  assert.ok(actionRail.includes('id="plan"'));
  assert.ok(actionRail.includes('id="execute"'));
  assert.ok(actionRail.indexOf('id="create-draft"') < actionRail.indexOf('id="approve"'));
  assert.ok(actionRail.indexOf('id="approve"') < actionRail.indexOf('id="plan"'));
  assert.ok(actionRail.indexOf('id="plan"') < actionRail.indexOf('id="execute"'));

  const statusFilter = extractBlock(html, 'id="composer-saved-status"', '</select>');
  const approvedMatches = statusFilter.match(/value="approved"/g) || [];
  const activeMatches = statusFilter.match(/value="active"/g) || [];
  assert.equal(approvedMatches.length, 1);
  assert.equal(activeMatches.length, 0);
});

test('phase272: category wizard wiring preserves type snapshots and status normalization contract', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const src = fs.readFileSync('src/index.js', 'utf8');

  assert.ok(js.includes('const COMPOSER_CATEGORY_FLOW_DEFS = Object.freeze({'));
  assert.ok(js.includes('function renderComposerCategoryWizard(payload, gateState) {'));
  assert.ok(js.includes('state.composerDraftByType = {};'));
  assert.ok(js.includes('function captureComposerDraftSnapshot(type) {'));
  assert.ok(js.includes('function restoreComposerDraftSnapshot(type) {'));
  assert.ok(js.includes('captureComposerDraftSnapshot(previousType);'));
  assert.ok(js.includes('restoreComposerDraftSnapshot(nextType);'));
  assert.ok(js.includes("if (raw === 'active') return 'approved';"));
  assert.ok(js.includes("if (raw === 'sent' || raw === 'executed') return 'sent';"));

  assert.ok(src.includes('function resolveComposerCategoryWizardFlag()'));
  assert.ok(src.includes('window.ENABLE_COMPOSER_CATEGORY_WIZARD_V1='));
  assert.ok(src.includes("composerWizardMode: resolveComposerCategoryWizardFlag() ? 'category_wizard_v1' : 'legacy'"));
});
