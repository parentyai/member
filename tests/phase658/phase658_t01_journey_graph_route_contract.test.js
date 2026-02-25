'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase658: index wiring includes journey graph admin routes and reaction-v2 endpoint', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/status'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/set'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/history'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/runtime'"));
  assert.ok(src.includes("pathname === '/api/admin/os/journey-graph/runtime/history'"));
  assert.ok(src.includes("pathname === '/api/phase37/deliveries/reaction-v2'"));
});

test('phase658: monitor pane includes journey graph map/rule editor controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="journey-graph-runtime-reload"'));
  assert.ok(html.includes('id="journey-graph-runtime-history"'));
  assert.ok(html.includes('id="journey-graph-status-reload"'));
  assert.ok(html.includes('id="journey-graph-plan"'));
  assert.ok(html.includes('id="journey-graph-set"'));
  assert.ok(html.includes('id="journey-graph-history"'));
  assert.ok(html.includes('id="journey-graph-catalog-json"'));
});

test('phase658: admin app fetches journey graph status/runtime/history endpoints', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("fetch('/api/admin/os/journey-graph/status'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-graph/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/journey-graph/set'"));
  assert.ok(js.includes("fetch('/api/admin/os/journey-graph/history?limit=20'"));
  assert.ok(js.includes('`/api/admin/os/journey-graph/runtime?'));
  assert.ok(js.includes('`/api/admin/os/journey-graph/runtime/history?'));
});
