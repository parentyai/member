'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { suggestNotificationMitigation } = require('../../src/usecases/phase141/suggestNotificationMitigation');

test('phase141: suggests mitigation when health is bad', () => {
  const suggestion = suggestNotificationMitigation({
    notificationHealthSummary: { countsByHealth: { DANGER: 1 } },
    topUnhealthyNotifications: [{ notificationId: 'N1', health: 'DANGER', ctr: 0.01 }]
  });
  assert.ok(suggestion);
  assert.strictEqual(suggestion.actionType, 'PAUSE_AND_REVIEW');
  assert.strictEqual(suggestion.requiredHumanCheck, true);
});

test('phase141: returns null when no unhealthy notifications', () => {
  const suggestion = suggestNotificationMitigation({
    notificationHealthSummary: { countsByHealth: { OK: 2 } },
    topUnhealthyNotifications: []
  });
  assert.strictEqual(suggestion, null);
});

