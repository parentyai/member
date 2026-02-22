'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback', () => {
  const src = readFileSync('src/routes/admin/osDashboardKpi.js', 'utf8');
  assert.ok(src.includes('analyticsReadRepo.listUsersByCreatedAtRange({'));
  assert.ok(src.includes('analyticsReadRepo.listNotificationsByCreatedAtRange({'));
  assert.ok(src.includes('if (users.length === 0) {'));
  assert.ok(
    src.includes('analyticsReadRepo.listAllUsers({ limit: scanLimit })') ||
      src.includes("fallbackSources.push('listUsersByCreatedAtRange:fallback');")
  );
  assert.ok(src.includes('if (notifications.length === 0) {'));
  assert.ok(
    src.includes('analyticsReadRepo.listAllNotifications({ limit: scanLimit })') ||
      src.includes("fallbackSources.push('listNotificationsByCreatedAtRange:fallback');")
  );
});
