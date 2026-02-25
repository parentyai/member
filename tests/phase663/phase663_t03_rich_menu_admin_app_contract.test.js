'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase663: index wiring includes rich menu admin os routes', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/api/admin/os/rich-menu/status'"));
  assert.ok(src.includes("pathname === '/api/admin/os/rich-menu/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/os/rich-menu/set'"));
  assert.ok(src.includes("pathname === '/api/admin/os/rich-menu/history'"));
  assert.ok(src.includes("pathname === '/api/admin/os/rich-menu/resolve-preview'"));
});

test('phase663: monitor pane includes rich menu operation controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="rich-menu-status-reload"'));
  assert.ok(html.includes('id="rich-menu-history"'));
  assert.ok(html.includes('id="rich-menu-resolve-preview"'));
  assert.ok(html.includes('id="rich-menu-action-select"'));
  assert.ok(html.includes('id="rich-menu-plan"'));
  assert.ok(html.includes('id="rich-menu-set"'));
  assert.ok(html.includes('id="rich-menu-action-payload-json"'));
  assert.ok(html.includes('id="rich-menu-template-rows"'));
  assert.ok(html.includes('id="rich-menu-run-rows"'));
});

test('phase663: admin app wires rich menu endpoints from monitor pane actions', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("fetch('/api/admin/os/rich-menu/status'"));
  assert.ok(js.includes("fetch('/api/admin/os/rich-menu/history?limit=20'"));
  assert.ok(js.includes("postJson('/api/admin/os/rich-menu/resolve-preview'"));
  assert.ok(js.includes("postJson('/api/admin/os/rich-menu/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/rich-menu/set'"));
});

