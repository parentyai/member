'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase637: css declares attribute-based nav visibility rules', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.app-nav .nav-group[data-nav-visible="false"]'));
  assert.ok(css.includes('display: none !important;'));
  assert.ok(css.includes('.app-nav .nav-group[data-nav-visible="true"]'));
  assert.ok(css.includes('display: grid;'));
});
