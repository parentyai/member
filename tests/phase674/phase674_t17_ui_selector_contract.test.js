'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: admin ui defines stable selector contract for shell/surfaces/controls', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('data-ui="admin-shell"'));
  assert.ok(html.includes('data-ui="left-nav"'));
  assert.ok(html.includes('data-ui="content-root"'));
  assert.ok(html.includes('data-ui="topbar"'));
  assert.ok(html.includes('data-ui="page-header"'));
  assert.ok(html.includes('data-control="page-primary-cta"'));
  assert.ok(html.includes('data-control="page-secondary-cta"'));

  assert.ok(src.includes('function applyUiContractSelectors()'));
  assert.ok(src.includes("document.querySelectorAll('.app-pane[data-pane]')"));
  assert.ok(src.includes("paneEl.setAttribute('data-surface', pane);"));
  assert.ok(src.includes("btnEl.setAttribute('data-control', `open-${pane}`);"));
});
