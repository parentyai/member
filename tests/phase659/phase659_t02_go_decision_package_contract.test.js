'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase659: go decision package contains latest stg fixed-order run evidence and verdict', () => {
  const text = fs.readFileSync('docs/CATCHUP_GO_DECISION_PACKAGE.md', 'utf8');
  assert.ok(text.includes('22379499260'));
  assert.ok(text.includes('https://github.com/parentyai/member/actions/runs/22379499260'));
  assert.ok(text.includes('pass=6 fail=0 skip=0'));
  assert.ok(text.includes('product_readiness_gate'));
  assert.ok(text.includes('Decision'));
  assert.ok(text.includes('GO'));
});
