'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase674: home exposes blocked-pane notice surface for unauthorized fallback', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="home-blocked-pane-notice"'));
  assert.ok(html.includes('data-ui="blocked-pane-notice"'));
  assert.ok(html.includes('id="home-blocked-pane-cause"'));
  assert.ok(html.includes('id="home-blocked-pane-action"'));
});

test('phase674: runtime keeps home fallback and syncs blocked-pane notice', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('function renderBlockedPaneNotice() {'));
  assert.ok(js.includes('function setBlockedPaneNotice(rawNotice) {'));
  assert.ok(js.includes('function reconcileBlockedPaneNotice(role) {'));
  assert.ok(js.includes('blockedPaneNotice: null'));
  assert.ok(js.includes("requestedPane: normalizedTarget"));
  assert.ok(js.includes("activatePane(allowedPane, { historyMode: 'replace', guardReason: 'ROLE_FORBIDDEN' });"));
});
