'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase652: phase5 users-summary route supports plan/subscriptionStatus/sort query params', () => {
  const src = fs.readFileSync('src/routes/phase5Ops.js', 'utf8');
  assert.ok(src.includes("const planRaw = url.searchParams.get('plan');"));
  assert.ok(src.includes("const subscriptionStatusRaw = url.searchParams.get('subscriptionStatus');"));
  assert.ok(src.includes("const sortKeyRaw = url.searchParams.get('sortKey');"));
  assert.ok(src.includes("const sortDirRaw = url.searchParams.get('sortDir');"));
  assert.ok(src.includes("throw new Error('invalid plan');"));
  assert.ok(src.includes("throw new Error('invalid subscriptionStatus');"));
  assert.ok(src.includes("throw new Error('invalid sortKey');"));
  assert.ok(src.includes("throw new Error('invalid sortDir');"));
  assert.ok(src.includes('filters: {'));
  assert.ok(src.includes("plan: plan || 'all'"));
  assert.ok(src.includes("subscriptionStatus: subscriptionStatus || 'all'"));
  assert.ok(src.includes('sort: {'));
  assert.ok(src.includes('sortKey: sortKey || null'));
  assert.ok(src.includes('sortDir: sortDir || null'));
});
