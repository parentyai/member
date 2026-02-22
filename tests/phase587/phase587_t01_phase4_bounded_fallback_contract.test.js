'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase587: phase4 summaries use bounded fallback sources instead of listAll callsites', () => {
  const userSummary = fs.readFileSync(path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js'), 'utf8');
  const notificationSummary = fs.readFileSync(path.join(process.cwd(), 'src/usecases/admin/getNotificationOperationalSummary.js'), 'utf8');

  assert.ok(userSummary.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');"));
  assert.ok(userSummary.includes("addFallbackSource('listNotificationDeliveriesBySentAtRange:fallback');"));
  assert.ok(userSummary.includes("addFallbackSource('listChecklistsByCreatedAtRange:fallback');"));
  assert.ok(userSummary.includes("addFallbackSource('listUserChecklistsByCreatedAtRange:fallback');"));

  assert.ok(!userSummary.includes('listAllEvents({ limit: analyticsLimit })'));
  assert.ok(!userSummary.includes('listAllNotificationDeliveries({ limit: analyticsLimit })'));
  assert.ok(!userSummary.includes('listAllChecklists({ limit: analyticsLimit })'));
  assert.ok(!userSummary.includes('listAllUserChecklists({ limit: analyticsLimit })'));

  assert.ok(notificationSummary.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');"));
  assert.ok(!notificationSummary.includes('listAllEvents({ limit: eventsLimit })'));
});

