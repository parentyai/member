'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase581: phase5 filtered summaries forward fallbackOnEmpty to phase4 usecases', () => {
  const usersFile = path.join(process.cwd(), 'src/usecases/phase5/getUsersSummaryFiltered.js');
  const notificationsFile = path.join(process.cwd(), 'src/usecases/phase5/getNotificationsSummaryFiltered.js');
  const usersSrc = fs.readFileSync(usersFile, 'utf8');
  const notificationsSrc = fs.readFileSync(notificationsFile, 'utf8');
  assert.ok(usersSrc.includes('fallbackOnEmpty: payload.fallbackOnEmpty,'));
  assert.ok(notificationsSrc.includes('fallbackOnEmpty: payload.fallbackOnEmpty,'));
});

