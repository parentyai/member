'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase641: admin app defines push/replace history sync and popstate handler', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('function updateHistoryWithPaneRole('));
  assert.ok(src.includes("historyMode: 'push'"));
  assert.ok(src.includes('globalThis.addEventListener(\'popstate\''));
  assert.ok(src.includes('setupHistorySync();'));
  assert.ok(src.includes('globalThis.history.pushState'));
  assert.ok(src.includes('globalThis.history.replaceState'));
});
