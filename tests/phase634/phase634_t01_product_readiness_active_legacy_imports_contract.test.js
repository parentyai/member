'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase634: product-readiness exposes active legacy repo imports in structure checks', () => {
  const src = fs.readFileSync('src/routes/admin/productReadiness.js', 'utf8');
  assert.ok(src.includes('activeLegacyRepoImports'));
  assert.ok(src.includes('structure_risk_active_legacy_imports_over_budget'));
  assert.ok(src.includes('active_legacy_repo_imports_max'));
});
