'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase577: phase4 notification summary exposes fallbackOnEmpty knob without breaking default branch', () => {
  const file = path.join(process.cwd(), 'src/usecases/admin/getNotificationOperationalSummary.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const fallbackOnEmpty = opts.fallbackOnEmpty !== false;'));
  assert.ok(src.includes('if (!events.length && !fallbackBlocked) {'));
  assert.ok(src.includes('if (fallbackOnEmpty || scoped.failed || rangeFailed) {'));
});
