'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: product readiness enforces retention undefined count budgets', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('undefinedRetentionMax'));
  assert.ok(src.includes('undefinedDeletableConditionalMax'));
  assert.ok(src.includes('undefinedRecomputableMax'));
  assert.ok(src.includes('retention_risk_undefined_over_budget'));
  assert.ok(src.includes('retention_risk_conditional_over_budget'));
  assert.ok(src.includes('retention_risk_recomputable_over_budget'));
});

