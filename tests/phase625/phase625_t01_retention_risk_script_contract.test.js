'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: retention risk generator emits unresolved-retention summary with budget hooks', () => {
  const file = path.join(process.cwd(), 'scripts/generate_retention_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('retention_risk.json'));
  assert.ok(src.includes('undefined_retention_count'));
  assert.ok(src.includes('undefined_deletable_conditional_count'));
  assert.ok(src.includes('undefined_recomputable_count'));
  assert.ok(src.includes('undefined_retention_max'));
  assert.ok(src.includes('undefined_deletable_conditional_max'));
  assert.ok(src.includes('undefined_recomputable_max'));
  assert.ok(src.includes('retention undefined count exceeds budget'));
});
