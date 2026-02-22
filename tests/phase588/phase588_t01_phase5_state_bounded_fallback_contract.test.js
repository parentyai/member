'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase588: phase5 state summary uses bounded fallback sources instead of listAll callsites', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js'), 'utf8');

  assert.ok(src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listNotificationDeliveriesBySentAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listChecklistsByCreatedAtRange:fallback');"));
  assert.ok(src.includes("addFallbackSource('listUserChecklistsByCreatedAtRange:fallback');"));

  assert.ok(!src.includes('listAllEvents({ limit: analyticsLimit })'));
  assert.ok(!src.includes('listAllNotificationDeliveries({ limit: analyticsLimit })'));
  assert.ok(!src.includes('listAllChecklists({ limit: analyticsLimit })'));
  assert.ok(!src.includes('listAllUserChecklists({ limit: analyticsLimit })'));
});

