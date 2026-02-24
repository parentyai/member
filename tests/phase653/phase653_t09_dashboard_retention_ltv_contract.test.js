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
const { aggregateJourneyKpis } = require('../../src/usecases/journey/aggregateJourneyKpis');

test('phase653: journey kpi aggregate computes retention/ltv metrics and pro counts', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const now = Date.parse('2026-02-24T00:00:00.000Z');

    await db.collection('users').doc('U1').set({
      createdAt: new Date(now - (120 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('users').doc('U2').set({
      createdAt: new Date(now - (50 * 24 * 60 * 60 * 1000))
    }, { merge: true });

    await db.collection('events').doc('E1').set({
      lineUserId: 'U1',
      type: 'user_phase_changed',
      toPhase: 'arrival',
      createdAt: new Date(now - (100 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E2').set({
      lineUserId: 'U1',
      type: 'next_action_shown',
      nextActions: [{ key: 'insurance' }, { key: 'school' }],
      createdAt: new Date(now - (90 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E3').set({
      lineUserId: 'U1',
      type: 'next_action_completed',
      nextActions: [{ key: 'insurance' }],
      createdAt: new Date(now - (80 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E4').set({
      lineUserId: 'U1',
      type: 'pro_prompted',
      createdAt: new Date(now - (70 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E5').set({
      lineUserId: 'U1',
      type: 'pro_converted',
      createdAt: new Date(now - (69 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E6').set({
      lineUserId: 'U2',
      type: 'user_phase_changed',
      toPhase: 'pre',
      createdAt: new Date(now - (20 * 24 * 60 * 60 * 1000))
    }, { merge: true });

    await db.collection('llm_usage_logs').doc('L1').set({
      userId: 'U1',
      plan: 'pro',
      decision: 'blocked',
      blockedReason: 'budget_exceeded',
      tokenUsed: 120,
      createdAt: new Date(now - (10 * 24 * 60 * 60 * 1000))
    }, { merge: true });

    await db.collection('user_subscriptions').doc('U1').set({
      lineUserId: 'U1',
      plan: 'pro',
      status: 'active'
    }, { merge: true });
    await db.collection('user_subscriptions').doc('U2').set({
      lineUserId: 'U2',
      plan: 'free',
      status: 'past_due'
    }, { merge: true });

    const kpi = await aggregateJourneyKpis({
      nowMs: now,
      lookbackDays: 120,
      scanLimit: 2000,
      write: false,
      actor: 'test'
    });

    assert.equal(kpi.totalUsers, 2);
    assert.equal(kpi.proActiveCount, 1);
    assert.equal(kpi.proActiveRatio, 0.5);
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.retention, 'd7'));
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.retention, 'd30'));
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.retention, 'd60'));
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.retention, 'd90'));
    assert.ok(kpi.nextActionShownCount >= 2);
    assert.ok(kpi.nextActionCompletedCount >= 1);
    assert.ok(kpi.nextActionExecutionRate > 0);
    assert.equal(kpi.proPromptedCount, 1);
    assert.equal(kpi.proConvertedCount, 1);
    assert.equal(kpi.proConversionRate, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.churnReasonRatio, 'blocked'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: dashboard and admin ui include pro_active card and journey kpi surfaces', () => {
  const html = require('node:fs').readFileSync('apps/admin/app.html', 'utf8');
  const js = require('node:fs').readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('data-dashboard-card="proActive"'));
  assert.ok(html.includes('id="dashboard-journey-kpi-reload"'));
  assert.ok(html.includes('id="dashboard-journey-kpi-result"'));
  assert.ok(js.includes('proActive: { kpiKeys: [\'pro_active_count\']'));
  assert.ok(js.includes('loadDashboardJourneyKpi('));
  assert.ok(js.includes('/api/admin/os/journey-kpi'));
});
