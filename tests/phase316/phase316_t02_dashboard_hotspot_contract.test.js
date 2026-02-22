'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase316: dashboard KPI read path uses bounded range queries for events/deliveries', () => {
  const src = readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  assert.ok(src.includes('resolveBucketQueryRange(buckets)'));
  assert.ok(src.includes('analyticsReadRepo.listNotificationDeliveriesBySentAtRange({'));
  assert.ok(src.includes('analyticsReadRepo.listEventsByCreatedAtRange({'));
});
