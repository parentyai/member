'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateNotificationPolicy } = require('../../src/domain/notificationPolicy');

test('phase160: notification policy is no-op when servicePhase/preset are unset', () => {
  const result = evaluateNotificationPolicy({
    servicePhase: null,
    notificationPreset: null,
    notificationCategory: null
  });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.enforced, false);
  assert.strictEqual(result.reason, 'policy_not_configured');
});

test('phase160: notification policy allows phase1 presetA immediate action', () => {
  const result = evaluateNotificationPolicy({
    servicePhase: 1,
    notificationPreset: 'A',
    notificationCategory: 'IMMEDIATE_ACTION'
  });
  assert.strictEqual(result.allowed, true);
  assert.strictEqual(result.enforced, true);
  assert.strictEqual(result.reason, 'allowed');
});

test('phase160: notification policy blocks disallowed category', () => {
  const result = evaluateNotificationPolicy({
    servicePhase: 1,
    notificationPreset: 'A',
    notificationCategory: 'SEQUENCE_GUIDANCE'
  });
  assert.strictEqual(result.allowed, false);
  assert.strictEqual(result.reason, 'notification_category_not_allowed');
});
