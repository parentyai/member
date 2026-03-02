'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase701: admin app surfaces legacy routes as read-only list with admin visibility', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('Legacy Routes'));
  assert.ok(html.includes('この一覧は参照専用です。legacy導線は凍結状態'));
  assert.ok(html.includes('id="repo-map-load-legacy"'));
  assert.ok(html.includes('disabled hidden'));

  assert.ok(js.includes("const hideLegacyStatusSurface = !ADMIN_LEGACY_STATUS_V1 || (nextRole !== 'developer' && nextRole !== 'admin');"));
});
