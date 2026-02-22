'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase364: analytics read repo provides scoped checklist/delivery methods', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/repos/firestore/analyticsReadRepo.js'), 'utf8');
  assert.ok(src.includes('async function listChecklistsByScenarioStepPairs(opts)'));
  assert.ok(src.includes('async function listNotificationDeliveriesByLineUserIdsAndSentAtRange(opts)'));
  assert.ok(src.includes('listChecklistsByScenarioStepPairs,'));
  assert.ok(src.includes('listNotificationDeliveriesByLineUserIdsAndSentAtRange,'));
});
