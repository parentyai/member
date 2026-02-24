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
const { computeDashboardKpis } = require('../../src/routes/admin/osDashboardKpi');

test('phase652: computeDashboardKpis includes billing and llm metrics', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const now = Date.now();
    const t1 = new Date(now - 60 * 60 * 1000);
    const t2 = new Date(now - 2 * 60 * 60 * 1000);

    await db.collection('users').doc('U1').set({
      createdAt: new Date(now - 24 * 60 * 60 * 1000),
      redacMembershipIdHash: 'hash_u1'
    }, { merge: true });
    await db.collection('users').doc('U2').set({
      createdAt: new Date(now - 2 * 24 * 60 * 60 * 1000)
    }, { merge: true });

    await db.collection('notifications').doc('N1').set({ createdAt: t1 }, { merge: true });
    await db.collection('notification_deliveries').doc('D1').set({
      sentAt: t1,
      delivered: true,
      clickAt: t1,
      readAt: t1
    }, { merge: true });
    await db.collection('events').doc('E1').set({
      createdAt: t1,
      type: 'FAQ_OPEN'
    }, { merge: true });

    await db.collection('link_registry').doc('L1').set({
      createdAt: t2,
      lastHealth: { state: 'WARN' }
    }, { merge: true });
    await db.collection('system_flags').doc('phase0').set({ killSwitch: false }, { merge: true });

    await db.collection('user_subscriptions').doc('U1').set({
      lineUserId: 'U1',
      plan: 'pro',
      status: 'active'
    }, { merge: true });
    await db.collection('user_subscriptions').doc('U2').set({
      lineUserId: 'U2',
      plan: 'free',
      status: 'canceled'
    }, { merge: true });

    await db.collection('llm_usage_logs').doc('LOG1').set({
      createdAt: t1,
      decision: 'allow'
    }, { merge: true });
    await db.collection('llm_usage_logs').doc('LOG2').set({
      createdAt: t1,
      decision: 'blocked'
    }, { merge: true });

    const result = await computeDashboardKpis(1, 2000, {
      fallbackMode: 'allow',
      fallbackOnEmpty: true
    });

    assert.equal(result.fallbackBlocked, false);
    assert.equal(result.kpis.pro_active_count.available, true);
    assert.equal(result.kpis.total_users.available, true);
    assert.equal(result.kpis.pro_ratio.available, true);
    assert.equal(result.kpis.llm_daily_usage_count.available, true);
    assert.equal(result.kpis.llm_avg_per_pro_user.available, true);
    assert.equal(result.kpis.llm_block_rate.available, true);

    assert.equal(result.kpis.pro_active_count.valueLabel, '1');
    assert.equal(result.kpis.total_users.valueLabel, '2');
    assert.equal(result.kpis.pro_ratio.valueLabel, '50%');
    assert.equal(result.kpis.llm_daily_usage_count.valueLabel, '2');
    assert.equal(result.kpis.llm_avg_per_pro_user.valueLabel, '2');
    assert.equal(result.kpis.llm_block_rate.valueLabel, '50%');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
