'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase371: product readiness route returns GO/NO_GO with blockers and checks', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes("status = blockers.length === 0 ? 'GO' : 'NO_GO'"));
  assert.ok(src.includes('product_readiness.view'));
  assert.ok(src.includes('blockers,'));
  assert.ok(src.includes('checks:'));
});
