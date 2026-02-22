'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase358: analytics read repo exposes notificationIds scoped events query', () => {
  const file = path.join(process.cwd(), 'src/repos/firestore/analyticsReadRepo.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('async function listEventsByNotificationIdsAndCreatedAtRange(opts)'));
  assert.ok(src.includes(".collection('events').where('ref.notificationId', '==', notificationId)"));
  assert.ok(src.includes("query = query.where('createdAt', '>=', fromAt);"));
  assert.ok(src.includes("query = query.where('createdAt', '<=', toAt);"));
  assert.ok(src.includes('listEventsByNotificationIdsAndCreatedAtRange,'));
});

