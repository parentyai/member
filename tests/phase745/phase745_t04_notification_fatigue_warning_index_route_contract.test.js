'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase745: index routes /api/admin/os/notification-fatigue-warning to admin handler', () => {
  const src = fs.readFileSync('src/index.js', 'utf8');
  assert.ok(src.includes("pathname === '/api/admin/os/notification-fatigue-warning'"));
  assert.ok(src.includes('handleNotificationFatigueWarning(req, res)'));
});
