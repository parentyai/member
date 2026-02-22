'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function count(source, pattern) {
  const matches = source.match(pattern);
  return Array.isArray(matches) ? matches.length : 0;
}

test('phase582: phase5 state summary consolidates duplicate listAll fallback callsites', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.equal(count(src, /listAllEvents\(\{ limit: analyticsLimit \}\)/g), 1);
  assert.equal(count(src, /listAllNotificationDeliveries\(\{ limit: analyticsLimit \}\)/g), 1);
  assert.ok(src.includes('const shouldFallbackEvents = fallbackOnEmpty || eventsResult.failed || rangeEventsFailed;'));
  assert.ok(src.includes('const shouldFallbackDeliveries = fallbackOnEmpty || deliveriesResult.failed || rangeDeliveriesFailed;'));
});

