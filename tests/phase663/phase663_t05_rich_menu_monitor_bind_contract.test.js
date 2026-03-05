'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase663: monitor controls bind rich-menu buttons and bootstrap status/history load', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes("document.getElementById('rich-menu-status-reload')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('rich-menu-history')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('rich-menu-resolve-preview')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('rich-menu-plan')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('rich-menu-set')?.addEventListener('click'"));
  assert.ok(js.includes("void loadRichMenuStatus({ notify: false });"));
  assert.ok(js.includes("void loadRichMenuHistory({ notify: false });"));
});
