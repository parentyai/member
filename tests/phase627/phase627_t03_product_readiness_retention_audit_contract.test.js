'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: product readiness audit payload includes retention summary fields', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes("action: 'product_readiness.view'"));
  assert.ok(src.includes('retentionUndefinedCount'));
  assert.ok(src.includes('retentionConditionalUndefinedCount'));
  assert.ok(src.includes('retentionRecomputableUndefinedCount'));
});

