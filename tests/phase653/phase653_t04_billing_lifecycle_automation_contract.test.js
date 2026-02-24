'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleBillingLifecycleAutomation } = require('../../src/usecases/billing/handleBillingLifecycleAutomation');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase653: billing lifecycle automation applies sync/menu/message and appends audit log', async () => {
  const restoreEnv = withEnv({ ENABLE_BILLING_LIFECYCLE_AUTOMATION: '1' });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const pushed = [];
    const result = await handleBillingLifecycleAutomation({
      lineUserId: 'U_BILL_AUTO_1',
      stripeEventId: 'evt_bill_auto_1',
      prevStatus: 'past_due',
      nextStatus: 'active'
    }, {
      journeyPolicyRepo: {
        getJourneyPolicy: async () => ({
          enabled: true,
          rich_menu_enabled: true,
          auto_upgrade_message_enabled: true,
          auto_downgrade_message_enabled: true
        })
      },
      userJourneyProfilesRepo: {
        getUserJourneyProfile: async () => ({ householdType: 'couple' })
      },
      syncJourneyTodoPlan: async () => ({ syncedCount: 4 }),
      applyPersonalizedRichMenu: async () => ({ status: 'applied' }),
      pushMessage: async (lineUserId, message) => {
        pushed.push({ lineUserId, message });
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'applied');
    assert.equal(result.prevPlan, 'free');
    assert.equal(result.nextPlan, 'pro');
    assert.ok(result.actionsApplied.includes('todo_sync:4'));
    assert.ok(result.actionsApplied.includes('rich_menu:applied'));
    assert.ok(result.actionsApplied.includes('upgrade_message_sent'));
    assert.equal(pushed.length, 1);

    const logs = Object.values((db._state.collections.billing_lifecycle_automation_logs || { docs: {} }).docs || {});
    assert.equal(logs.length, 1);
    assert.equal(logs[0].data.lineUserId, 'U_BILL_AUTO_1');
    assert.equal(logs[0].data.stripeEventId, 'evt_bill_auto_1');
    assert.equal(logs[0].data.decision, 'applied');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: billing lifecycle automation supports env-off fail-safe', async () => {
  const restoreEnv = withEnv({ ENABLE_BILLING_LIFECYCLE_AUTOMATION: '0' });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const result = await handleBillingLifecycleAutomation({
      lineUserId: 'U_BILL_AUTO_2',
      stripeEventId: 'evt_bill_auto_2',
      prevStatus: 'active',
      nextStatus: 'canceled'
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'disabled_by_env');
    assert.deepEqual(result.actionsApplied, []);

    const logs = Object.values((db._state.collections.billing_lifecycle_automation_logs || { docs: {} }).docs || {});
    assert.equal(logs.length, 1);
    assert.equal(logs[0].data.decision, 'disabled_by_env');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
