'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase264: admin.css provides table scroll + sticky header rules (contract)', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin.css');
  const css = fs.readFileSync(filePath, 'utf8');

  assert.ok(css.includes('.table-scroll'));
  assert.ok(css.includes('max-height: 360px'));
  assert.ok(css.includes('.table-scroll thead th'));
  assert.ok(css.includes('position: sticky'));
  assert.ok(css.includes('.cell-num'));
});

