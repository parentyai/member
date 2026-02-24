'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase651: admin app defines local preflight banner fields', () => {
  const html = fs.readFileSync('apps/admin/app.html', 'utf8');
  assert.ok(html.includes('id="admin-local-preflight-banner"'));
  assert.ok(html.includes('data-local-preflight-field="cause"'));
  assert.ok(html.includes('data-local-preflight-field="impact"'));
  assert.ok(html.includes('data-local-preflight-field="action"'));
});

test('phase651: admin css provides local preflight banner styles', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  assert.ok(css.includes('.admin-local-preflight-banner'));
  assert.ok(css.includes('.admin-local-preflight-banner.is-danger'));
  assert.ok(css.includes('.admin-local-preflight-banner.is-warn'));
});
