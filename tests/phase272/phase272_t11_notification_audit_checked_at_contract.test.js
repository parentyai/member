'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase272: notification audits append checkedAt for create/preview/approve/plan/execute', () => {
  const routeSrc = readFileSync('src/routes/admin/osNotifications.js', 'utf8');
  const planSrc = readFileSync('src/usecases/adminOs/planNotificationSend.js', 'utf8');
  const executeSrc = readFileSync('src/usecases/adminOs/executeNotificationSend.js', 'utf8');

  assert.ok(routeSrc.includes('function addCheckedAt('));
  assert.ok(routeSrc.includes("action: 'notifications.create'"));
  assert.ok(routeSrc.includes("action: 'notifications.preview'"));
  assert.ok(routeSrc.includes("action: 'notifications.approve'"));
  assert.ok(routeSrc.includes('payloadSummary: addCheckedAt('));

  assert.ok(planSrc.includes("action: 'notifications.send.plan'"));
  assert.ok(planSrc.includes('checkedAt: serverTime'));

  assert.ok(executeSrc.includes("action: 'notifications.send.execute'"));
  assert.ok(executeSrc.includes('checkedAt: new Date().toISOString()'));
});

