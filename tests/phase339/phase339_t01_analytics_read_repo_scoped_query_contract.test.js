'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase339: analyticsReadRepo defines user-scoped query readers', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/analyticsReadRepo.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('async function listEventsByLineUserIdAndCreatedAtRange'));
  assert.ok(src.includes('async function listNotificationDeliveriesByLineUserIdAndSentAtRange'));
  assert.ok(src.includes('async function listUserChecklistsByLineUserId'));
});
