'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase633: nav keeps major two groups and hides citypack/vendors legacy blocks', () => {
  const css = fs.readFileSync('apps/admin/assets/admin.css', 'utf8');

  assert.ok(css.includes('.app-nav .nav-group:not(.nav-group-dashboard):not(.nav-group-catalog)'));
  assert.ok(css.includes('.city-pack-legacy-block,'));
  assert.ok(css.includes('.vendors-legacy-block'));
  assert.ok(css.includes('display: none !important;'));
});
