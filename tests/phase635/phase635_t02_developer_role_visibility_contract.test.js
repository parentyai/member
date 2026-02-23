'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase635: developer-only blocks are hidden for operator/admin roles', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.app-shell[data-role="operator"] [data-role="developer"],'));
  assert.ok(css.includes('.app-shell[data-role="admin"] [data-role="developer"]'));
  assert.ok(css.includes('display: none !important;'));
});

