'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase320: user state summary uses user-targeted read and range-first events/deliveries', () => {
  const src = readFileSync('src/usecases/phase5/getUserStateSummary.js', 'utf8');
  assert.ok(src.includes("const usersRepo = require('../../repos/firestore/usersRepo');"));
  assert.ok(src.includes('const user = await usersRepo.getUser(payload.lineUserId);'));
  assert.ok(src.includes('resolveAnalyticsQueryRangeFromUser(user)'));
  assert.ok(src.includes('listEventsByCreatedAtRange({'));
  assert.ok(src.includes('listNotificationDeliveriesBySentAtRange({'));
  assert.ok(src.includes('if (events.length === 0) {'));
  assert.ok(src.includes('if (deliveries.length === 0) {'));
  assert.ok(src.includes('listUsersByMemberNumber: usersRepo.listUsersByMemberNumber'));
});
