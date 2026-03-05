'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase730: task-rules config supports upsert_task_content action and status payload includes taskContents', () => {
  const src = read('src/routes/admin/taskRulesConfig.js');
  assert.ok(src.includes("'upsert_task_content'"));
  assert.ok(src.includes('task_content_admin_editor_disabled'));
  assert.ok(src.includes('taskContentsRepo.listTaskContents'));
  assert.ok(src.includes('taskContents: taskContents.length'));
});

test('phase730: monitor pane includes task detail editor and link registry controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="task-rules-task-content-load"'));
  assert.ok(html.includes('id="task-rules-task-content-plan"'));
  assert.ok(html.includes('id="task-rules-task-content-set"'));
  assert.ok(html.includes('id="task-rules-task-content-key"'));
  assert.ok(html.includes('id="task-rules-task-content-manual-text"'));
  assert.ok(html.includes('id="task-rules-task-content-failure-text"'));
  assert.ok(html.includes('id="task-rules-task-content-video-link-id"'));
  assert.ok(html.includes('id="task-rules-task-content-action-link-id"'));
  assert.ok(html.includes('task-rules = 判定/配信ロジック、task-content = LINE表示/教材本文'));
  assert.ok(html.includes('id="task-rules-task-content-warning"'));
  assert.ok(html.includes('id="task-rules-link-registry-reload"'));
  assert.ok(html.includes('id="task-rules-link-registry-create"'));
  assert.ok(html.includes('id="task-rules-link-registry-set"'));
});

test('phase730: admin app wires task detail editor and link registry actions', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("action: 'upsert_task_content'"));
  assert.ok(js.includes("postJson('/api/admin/os/task-rules/plan'"));
  assert.ok(js.includes("postJson('/api/admin/os/task-rules/set'"));
  assert.ok(js.includes("document.getElementById('task-rules-task-content-plan')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-task-content-set')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-link-registry-reload')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-link-registry-create')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-link-registry-set')?.addEventListener('click'"));
  assert.ok(js.includes("adminFetchJson({"));
  assert.ok(js.includes("url: '/admin/link-registry'"));
  assert.ok(js.includes('refreshTaskRulesTaskContentWarnings'));
  assert.ok(js.includes('collectTaskRulesTaskContentWarnings'));
  assert.ok(js.includes("setTextContent('task-rules-task-content-warning'"));
});
