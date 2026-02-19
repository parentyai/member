'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: composer danger actions require confirm and keep trace-aware calls', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(js.includes("window.confirm(t('ui.confirm.composer.approve'"));
  assert.ok(js.includes("window.confirm(t('ui.confirm.composer.execute'"));
  assert.ok(js.includes("ensureTraceInput('traceId')"));
  assert.ok(js.includes("postJson('/api/admin/os/notifications/approve'"));
  assert.ok(js.includes("postJson('/api/admin/os/notifications/send/execute'"));
});
