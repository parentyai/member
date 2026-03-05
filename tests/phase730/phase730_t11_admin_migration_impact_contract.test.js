'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase730: task-rules config supports task-content link migration plan/apply actions', () => {
  const src = read('src/routes/admin/taskRulesConfig.js');
  assert.ok(src.includes("'migrate_task_content_links'"));
  assert.ok(src.includes("'migrate_task_content_links_apply'"));
  assert.ok(src.includes('task_content_link_migration_disabled'));
  assert.ok(src.includes('task_content_link_migration_apply_disabled'));
  assert.ok(src.includes('planTaskContentLinkMigration'));
  assert.ok(src.includes('applyTaskContentLinkMigration'));
});

test('phase730: monitor pane includes migration and link-impact controls', () => {
  const html = read('apps/admin/app.html');
  assert.ok(html.includes('id="task-rules-task-content-link-plan"'));
  assert.ok(html.includes('id="task-rules-task-content-link-apply"'));
  assert.ok(html.includes('id="task-rules-task-content-link-manual-map-json"'));
  assert.ok(html.includes('id="task-rules-task-content-link-result"'));
  assert.ok(html.includes('id="task-rules-link-impact-reload"'));
  assert.ok(html.includes('id="task-rules-link-impact-limit"'));
  assert.ok(html.includes('id="task-rules-link-impact-rows"'));
  assert.ok(html.includes('id="task-rules-link-impact-result"'));
});

test('phase730: admin app wires migration and impact endpoints', () => {
  const js = read('apps/admin/assets/admin_app.js');
  assert.ok(js.includes("action: 'migrate_task_content_links'"));
  assert.ok(js.includes("action: 'migrate_task_content_links_apply'"));
  assert.ok(js.includes("fetch(`/api/admin/os/link-registry-impact?${query.toString()}`"));
  assert.ok(js.includes("document.getElementById('task-rules-task-content-link-plan')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-task-content-link-apply')?.addEventListener('click'"));
  assert.ok(js.includes("document.getElementById('task-rules-link-impact-reload')?.addEventListener('click'"));
});

test('phase730: index wires task UX audit internal route and link impact route', () => {
  const index = read('src/index.js');
  assert.ok(index.includes("pathname === '/internal/jobs/task-ux-audit'"));
  assert.ok(index.includes("pathname === '/api/admin/os/link-registry-impact'"));
});
