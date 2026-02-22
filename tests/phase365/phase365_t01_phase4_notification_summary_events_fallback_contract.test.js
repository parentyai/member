'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase365: phase4 notification summary uses global events fallback only after scoped/range query failures', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/usecases/admin/getNotificationOperationalSummary.js'), 'utf8');
  assert.ok(src.includes('let rangeFailed = false;'));
  assert.ok(src.includes('if (!events.length && (scoped.failed || rangeFailed)) {'));
  assert.ok(src.includes('events = [];'));
  assert.ok(!src.includes('events = await listAllEvents({ limit: eventsLimit });\n      addFallbackSource(\'listAllEvents\');\n    } else {'));
});
