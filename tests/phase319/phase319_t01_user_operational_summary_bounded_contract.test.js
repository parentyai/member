'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase319: user operational summary uses range-first events/deliveries with fallback', () => {
  const src = readFileSync('src/usecases/admin/getUserOperationalSummary.js', 'utf8');
  assert.ok(src.includes('resolveAnalyticsQueryRangeFromUsers(users)'));
  assert.ok(src.includes('listEventsByCreatedAtRange({'));
  assert.ok(src.includes('listNotificationDeliveriesBySentAtRange({'));
  assert.ok(src.includes('if (events.length === 0) {'));
  assert.ok(
    src.includes('listAllEvents({ limit: analyticsLimit })') ||
      src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');")
  );
  assert.ok(src.includes('if (deliveries.length === 0) {'));
  assert.ok(
    src.includes('listAllNotificationDeliveries({ limit: analyticsLimit })') ||
      src.includes("addFallbackSource('listNotificationDeliveriesBySentAtRange:fallback');")
  );
});
