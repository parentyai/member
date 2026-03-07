'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase745: admin settings includes UX Policy read-only console surface', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="ux-policy-readonly-panel"'));
  assert.ok(html.includes('id="ux-policy-line-user-id"'));
  assert.ok(html.includes('id="ux-policy-reload"'));
  assert.ok(html.includes('id="ux-policy-next-best-action"'));
  assert.ok(html.includes('id="ux-policy-fatigue-warning"'));
});

test('phase745: UX Policy console uses GET-only fetch routes and no write calls', () => {
  const src = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(src.includes('ENABLE_UXOS_POLICY_READONLY_V1'));
  assert.ok(src.includes("fetchUxPolicyReadonlyJson('/api/admin/os/journey-policy/status'"));
  assert.ok(src.includes("fetchUxPolicyReadonlyJson('/api/admin/os/task-rules/status'"));
  assert.ok(src.includes("fetchUxPolicyReadonlyJson('/api/admin/llm/policy/status'"));
  assert.ok(src.includes('/api/admin/os/next-best-action?lineUserId='));
  assert.ok(src.includes('/api/admin/os/notification-fatigue-warning?'));
  assert.equal(src.includes("postJson('/api/admin/os/notification-fatigue-warning'"), false);
  assert.equal(src.includes("postJson('/api/admin/os/next-best-action'"), false);
});
