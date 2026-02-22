'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase308: top3 analytics hotspots use explicit bounded limits', () => {
  const dashboard = readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  assert.ok(dashboard.includes('const MAX_SCAN_LIMIT = 3000;'));
  assert.ok(dashboard.includes('const DEFAULT_SCAN_LIMIT = 2000;'));
  assert.ok(dashboard.includes('analyticsReadRepo.listEventsByCreatedAtRange({'));
  assert.ok(dashboard.includes('analyticsReadRepo.listNotificationDeliveriesBySentAtRange({'));
  assert.ok(dashboard.includes('resolveBucketQueryRange(buckets)'));

  const userSummary = readFileSync('src/usecases/admin/getUserOperationalSummary.js', 'utf8');
  assert.ok(userSummary.includes('const DEFAULT_ANALYTICS_LIMIT = 1200;'));
  assert.ok(userSummary.includes('const MAX_ANALYTICS_LIMIT = 2000;'));
  assert.ok(userSummary.includes('usersRepo.listUsers({ limit: analyticsLimit })'));
  assert.ok(userSummary.includes('listAllNotificationDeliveries({ limit: analyticsLimit })'));

  const stateSummary = readFileSync('src/usecases/phase5/getUserStateSummary.js', 'utf8');
  assert.ok(stateSummary.includes('const DEFAULT_ANALYTICS_LIMIT = 1200;'));
  assert.ok(stateSummary.includes('const MAX_ANALYTICS_LIMIT = 2000;'));
  assert.ok(stateSummary.includes('listAllEvents({ limit: analyticsLimit })'));
  assert.ok(stateSummary.includes('listAllChecklists({ limit: analyticsLimit })'));
});
