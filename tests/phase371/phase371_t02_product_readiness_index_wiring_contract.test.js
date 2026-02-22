'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase371: index routes /api/admin/product-readiness', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/product-readiness'"));
  assert.ok(src.includes('handleProductReadiness'));
});
