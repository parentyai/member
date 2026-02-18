'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase262: admin.css provides focus-visible and reduced-motion rules (contract)', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin.css');
  const css = fs.readFileSync(filePath, 'utf8');

  assert.ok(css.includes(':focus-visible'));
  assert.ok(css.includes('outline: 2px solid'));
  assert.ok(css.includes('@media (prefers-reduced-motion: reduce)'));
  assert.ok(css.includes('.toast { transition: none'));
});

