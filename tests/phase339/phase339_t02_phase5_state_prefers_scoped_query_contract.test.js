'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase339: phase5 state summary uses scoped queries before listAll fallback', () => {
  const file = path.join(process.cwd(), 'src/usecases/phase5/getUserStateSummary.js');
  const src = fs.readFileSync(file, 'utf8');

  assert.ok(src.includes('listEventsByLineUserIdAndCreatedAtRange'));
  assert.ok(src.includes('listNotificationDeliveriesByLineUserIdAndSentAtRange'));
  assert.ok(src.includes('listUserChecklistsByLineUserId'));
  assert.ok(
    src.includes('listAllEvents') ||
      src.includes("addFallbackSource('listEventsByCreatedAtRange:fallback');")
  );
  assert.ok(
    src.includes('listAllNotificationDeliveries') ||
      src.includes("addFallbackSource('listNotificationDeliveriesBySentAtRange:fallback');")
  );
  assert.ok(
    src.includes('listAllUserChecklists') ||
      src.includes("addFallbackSource('listUserChecklistsByCreatedAtRange:fallback');")
  );
});
