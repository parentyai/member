'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase173: master ui renders impact preview risk and breakdown labels', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /riskLevel:/);
  assert.match(text, /recommendedAction:/);
  assert.match(text, /capTypeBreakdown/);
  assert.match(text, /reasonBreakdown/);
  assert.match(text, /categoryBreakdown/);
});

test('phase173: master ui includes delivery recovery operation guidance', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /formatDeliveryRecoveryRecommendation/);
  assert.match(text, /use seal to close stuck reserved\/in-flight records/);
  assert.match(text, /retry first if cause is recoverable/);
});
