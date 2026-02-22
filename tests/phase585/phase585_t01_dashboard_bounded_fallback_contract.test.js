'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase585: dashboard users/notifications empty fallback uses bounded range query (no listAll)', () => {
  const file = path.join(process.cwd(), 'src/routes/admin/osDashboardKpi.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes("fallbackSources.push('listUsersByCreatedAtRange:fallback');"));
  assert.ok(src.includes("fallbackSources.push('listNotificationsByCreatedAtRange:fallback');"));
  assert.ok(!src.includes('analyticsReadRepo.listAllUsers({ limit: scanLimit })'));
  assert.ok(!src.includes('analyticsReadRepo.listAllNotifications({ limit: scanLimit })'));
});

