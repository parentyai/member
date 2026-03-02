'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: composer card action mirrors delegate to existing top action handlers', () => {
  const html = readFileSync('apps/admin/app.html', 'utf8');
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('id="composer-card-draft"'));
  assert.ok(html.includes('id="composer-card-preview"'));
  assert.ok(html.includes('id="composer-card-approve"'));
  assert.ok(html.includes('id="composer-card-plan"'));
  assert.ok(html.includes('id="composer-card-execute"'));

  assert.ok(js.includes('function bindComposerCardActionMirrors() {'));
  assert.ok(js.includes("{ mirrorId: 'composer-card-draft', sourceId: 'create-draft' }"));
  assert.ok(js.includes("{ mirrorId: 'composer-card-preview', sourceId: 'preview' }"));
  assert.ok(js.includes("{ mirrorId: 'composer-card-approve', sourceId: 'approve' }"));
  assert.ok(js.includes("{ mirrorId: 'composer-card-plan', sourceId: 'plan' }"));
  assert.ok(js.includes("{ mirrorId: 'composer-card-execute', sourceId: 'execute' }"));
  assert.ok(js.includes('bindComposerCardActionMirrors();'));
});

test('phase272: composer saved list and matrix accept includeArchivedSeed only via developer toggle', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const html = readFileSync('apps/admin/app.html', 'utf8');

  assert.ok(html.includes('id="composer-include-archived-seed"'));
  assert.ok(js.includes('function shouldShowComposerArchivedSeedToggle() {'));
  assert.ok(js.includes('function resolveComposerIncludeArchivedSeedFlag() {'));
  assert.ok(js.includes("query.set('includeArchivedSeed', '1')"));
  assert.ok(js.includes('includeArchivedSeed: resolveComposerIncludeArchivedSeedFlag()'));
});
