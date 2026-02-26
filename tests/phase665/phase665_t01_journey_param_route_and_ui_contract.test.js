'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase665: index wiring includes journey-param admin endpoints', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/status'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/validate'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/dry-run'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/apply'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/rollback'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-param/history'"));
});

test('phase665: monitor pane exposes journey param console controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="journey-param-version-id"'));
  assert.ok(html.includes('id="journey-param-rollback-to-version-id"'));
  assert.ok(html.includes('id="journey-param-status-reload"'));
  assert.ok(html.includes('id="journey-param-plan"'));
  assert.ok(html.includes('id="journey-param-validate"'));
  assert.ok(html.includes('id="journey-param-dry-run"'));
  assert.ok(html.includes('id="journey-param-apply"'));
  assert.ok(html.includes('id="journey-param-rollback"'));
  assert.ok(html.includes('id="journey-param-history"'));
});

test('phase665: admin app calls journey-param endpoints', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("fetch('/api/admin/os/journey-param/status'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-param/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-param/validate'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-param/dry-run'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-param/apply'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-param/rollback'"));
  assert.ok(js.includes("fetch('/api/admin/os/journey-param/history?limit=20'"));
});
