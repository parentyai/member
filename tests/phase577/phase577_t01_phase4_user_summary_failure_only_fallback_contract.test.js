'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase577: phase4 users summary exposes fallbackOnEmpty knob for failure-only fallback control', () => {
  const file = path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const fallbackOnEmpty = opts.fallbackOnEmpty !== false;'));
  assert.ok(src.includes('if (events.length === 0 && !fallbackBlocked) {'));
  assert.ok(src.includes('if (fallbackOnEmpty || eventsResult.failed || rangeEventsFailed) {'));
  assert.ok(src.includes('if (deliveries.length === 0 && !fallbackBlocked) {'));
  assert.ok(src.includes('if (fallbackOnEmpty || deliveriesResult.failed || rangeDeliveriesFailed) {'));
  assert.ok(src.includes('if (checklistsResult.failed || checklists.length === 0) {'));
  assert.ok(src.includes('if (!checklistsResult.failed && !fallbackOnEmpty) {'));
  assert.ok(src.includes('if (userChecklistsResult.failed || userChecklists.length === 0) {'));
  assert.ok(src.includes('if (!userChecklistsResult.failed && !fallbackOnEmpty) {'));
});
