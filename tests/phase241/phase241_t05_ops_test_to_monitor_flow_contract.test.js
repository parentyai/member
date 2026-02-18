'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase241: ops safe test flow propagates traceId into monitor pane', () => {
  const js = readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  assert.ok(js.includes('async function runHomeSafeTest()'));
  assert.ok(js.includes('/api/admin/send-test'));
  assert.ok(js.includes('function navigateToMonitorWithTrace(traceId, lineUserId)'));
  assert.ok(js.includes("activatePane('monitor')"));
  assert.ok(js.includes('loadMonitorUserDeliveries({ notify: false })'));
});
