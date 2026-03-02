'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase701: high-risk clusters emit read_path_load observation metrics', () => {
  const helper = fs.readFileSync('src/ops/readPathLoadMetric.js', 'utf8');
  const reviewInbox = fs.readFileSync('src/routes/admin/cityPackReviewInbox.js', 'utf8');
  const notifications = fs.readFileSync('src/routes/admin/osNotifications.js', 'utf8');
  const analytics = fs.readFileSync('src/routes/admin/opsOverview.js', 'utf8');

  assert.ok(helper.includes("action: 'read_path_load'"));
  assert.ok(helper.includes('scannedCount'));
  assert.ok(helper.includes('durationMs'));
  assert.ok(helper.includes('fallbackUsed'));

  assert.ok(reviewInbox.includes("cluster: 'city_pack_review_inbox'"));
  assert.ok(reviewInbox.includes("operation: 'list_source_refs'"));
  assert.ok(notifications.includes("cluster: 'notifications'"));
  assert.ok(notifications.includes("operation: 'list_notifications'"));
  assert.ok(analytics.includes("cluster: 'analytics_read_model'"));
  assert.ok(analytics.includes("operation: 'users_summary'"));
  assert.ok(analytics.includes("operation: 'notifications_summary'"));
});
