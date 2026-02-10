'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression)', () => {
  const filePath = path.resolve(__dirname, '..', '..', 'apps', 'admin', 'ops_readonly.html');
  const html = fs.readFileSync(filePath, 'utf8');

  // Hard rule: do not use innerHTML anywhere in admin ops UI.
  assert.ok(!html.includes('innerHTML'), 'innerHTML must not be used in ops_readonly.html');

  // Heuristic: ensure we use textContent-based rendering.
  assert.ok(html.includes('textContent'), 'expected textContent usage in ops_readonly.html');
});

