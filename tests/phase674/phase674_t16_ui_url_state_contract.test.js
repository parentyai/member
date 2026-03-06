'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: admin ui keeps URL/deep-link/back-forward state contract', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(src.includes('function resolvePaneFromLocation()'));
  assert.ok(src.includes("const queryPane = currentUrl.searchParams.get('pane');"));
  assert.ok(src.includes("if (queryPane) return { pane: queryPane, source: 'query' };"));
  assert.ok(src.includes("globalThis.addEventListener('popstate'"));
  assert.ok(src.includes("globalThis.addEventListener('hashchange'"));
  assert.ok(src.includes('updateHistoryWithPaneRole(nextPane, state.role, mode);'));
  assert.ok(src.includes("if (appShell) appShell.setAttribute('data-view-pane', nextPane);"));
});
