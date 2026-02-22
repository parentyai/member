'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase358: notification summary collects notification ids and queries scoped events first', () => {
  const file = path.join(process.cwd(), 'src/usecases/admin/getNotificationOperationalSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('collectNotificationIds(notifications)'));
  assert.ok(src.includes('listEventsByNotificationIdsAndCreatedAtRange({'));
  assert.ok(src.includes('notificationIds,'));
  assert.ok(src.includes('events = await listEventsByCreatedAtRange({'));
  assert.ok(
    src.includes("addFallbackSource('listAllEvents');") ||
      src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');")
  );
});
