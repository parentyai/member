'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase321: monitor insights uses sentAt range query first with bounded fallback', () => {
  const src = readFileSync('src/routes/admin/monitorInsights.js', 'utf8');
  assert.ok(src.includes('listNotificationDeliveriesBySentAtRange({'));
  assert.ok(src.includes('fromAt: new Date(sinceMs)'));
  assert.ok(src.includes('toAt: new Date(nowMs)'));
  assert.ok(src.includes('if (!all.length) {'));
  assert.ok(
    src.includes('listAllNotificationDeliveries({ limit: readLimit })') ||
      src.includes("fallbackSources.push('listNotificationDeliveriesBySentAtRange:fallback');")
  );
});
