'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase347: phase4 usecases guard listAll fallback when fallbackMode is block', () => {
  const userSummaryFile = path.join(process.cwd(), 'src/usecases/admin/getUserOperationalSummary.js');
  const notificationSummaryFile = path.join(process.cwd(), 'src/usecases/admin/getNotificationOperationalSummary.js');
  const userSrc = fs.readFileSync(userSummaryFile, 'utf8');
  const notificationSrc = fs.readFileSync(notificationSummaryFile, 'utf8');

  assert.ok(userSrc.includes("const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;"));
  assert.ok(
    userSrc.includes('if (events.length === 0 && !fallbackBlocked) {') ||
      userSrc.includes('if (!fallbackBlocked && shouldFallbackEvents) {')
  );
  assert.ok(
    userSrc.includes('if (deliveries.length === 0 && !fallbackBlocked) {') ||
      userSrc.includes('if (!fallbackBlocked && shouldFallbackDeliveries) {')
  );

  assert.ok(notificationSrc.includes("const fallbackBlocked = fallbackMode === FALLBACK_MODE_BLOCK;"));
  assert.ok(notificationSrc.includes('if (!events.length && !fallbackBlocked) {'));
  assert.ok(
    notificationSrc.includes('if (fallbackOnEmpty || scoped.failed || rangeFailed) {') ||
      notificationSrc.includes('if (!events.length && !fallbackBlocked) {')
  );
  assert.ok(notificationSrc.includes("dataSource: fallbackBlockedNotAvailable ? 'not_available' : 'computed'"));
});
