'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: numeric cells use cell-number alignment class', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(css.includes('.cell-number'));
  assert.ok(js.includes('cell-number'));
});
