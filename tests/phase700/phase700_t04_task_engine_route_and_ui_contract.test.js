'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase700: index wiring includes task api, task nudge job, and task rules admin routes', () => {
  const src = read('src/index.js');
  assert.ok(src.includes("pathname === '/internal/jobs/task-nudge'"));
  assert.ok(src.includes("pathname === '/api/tasks' || pathname.startsWith('/api/tasks/')"));
  assert.ok(src.includes("pathname === '/api/admin/os/task-rules/status'"));
  assert.ok(src.includes("pathname === '/api/admin/os/task-rules/plan'"));
  assert.ok(src.includes("pathname === '/api/admin/os/task-rules/set'"));
  assert.ok(src.includes("pathname === '/api/admin/os/task-rules/history'"));
  assert.ok(src.includes("pathname === '/api/admin/os/task-rules/dry-run'"));
});

test('phase700: monitor pane includes task rules controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="task-rules-status-reload"'));
  assert.ok(html.includes('id="task-rules-plan"'));
  assert.ok(html.includes('id="task-rules-set"'));
  assert.ok(html.includes('id="task-rules-history"'));
  assert.ok(html.includes('id="task-rules-dry-run"'));
  assert.ok(html.includes('id="task-rules-rule-id"'));
  assert.ok(html.includes('id="task-rules-dry-run-user-id"'));
});

test('phase700: admin app wires task rules endpoints and monitor bindings', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("fetch('/api/admin/os/task-rules/status?limit=200'"));
  assert.ok(js.includes("postJson('/api/admin/os/task-rules/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/task-rules/set'"));
  assert.ok(js.includes("fetch('/api/admin/os/task-rules/history?limit=20'"));
  assert.ok(js.includes("postJson('/api/admin/os/task-rules/dry-run'"));
  assert.ok(js.includes("document.getElementById('task-rules-status-reload')?.addEventListener('click'"));
});
