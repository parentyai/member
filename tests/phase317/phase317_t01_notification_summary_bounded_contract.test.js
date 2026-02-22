'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase317: notification operational summary uses bounded range query with legacy fallback', () => {
  const src = readFileSync('src/usecases/admin/getNotificationOperationalSummary.js', 'utf8');
  assert.ok(src.includes("listEventsByCreatedAtRange({"));
  assert.ok(src.includes('if (!events.length) {'));
  assert.ok(
    src.includes('events = await listAllEvents({ limit: eventsLimit });') ||
      src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');")
  );
});
