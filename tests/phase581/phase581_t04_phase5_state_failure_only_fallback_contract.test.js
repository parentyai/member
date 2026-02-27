'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase581: phase5 state summary uses fallbackOnEmpty in failure-only fallback branch', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const fallbackOnEmpty = payload.fallbackOnEmpty === true;'));
  assert.ok(src.includes('const shouldFallbackEvents = fallbackOnEmpty || eventsResult.failed || rangeEventsFailed;'));
  assert.ok(src.includes('const shouldFallbackDeliveries = fallbackOnEmpty || deliveriesResult.failed || rangeDeliveriesFailed;'));
  assert.ok(src.includes('if (!checklistsResult.failed && !fallbackOnEmpty) {'));
  assert.ok(src.includes('if (!userChecklistsResult.failed && !fallbackOnEmpty) {'));
});
