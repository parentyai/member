'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase854: admin blocker rendering keeps using title-summary-action fields after precision repair', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const start = js.indexOf('function renderQualityPatrolObservationBlockers(result) {');
  const end = js.indexOf('function renderQualityPatrolRecommendedPr(result) {', start);
  const block = js.slice(start, end);

  assert.ok(block.includes('item.title'));
  assert.ok(block.includes('item.summary'));
  assert.ok(block.includes('item.affectedSlices'));
  assert.ok(block.includes('item.recommendedAction'));
  assert.equal(block.includes('item.code'), false);
  assert.equal(block.includes('item.category'), false);
});
