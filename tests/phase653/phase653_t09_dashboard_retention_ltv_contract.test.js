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
    await db.collection('events').doc('E7').set({
      lineUserId: 'U2',
      type: 'next_action_shown',
      nextActions: [{ key: 'dmv_visit' }],
      createdAt: new Date(now - (3 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E8').set({
      lineUserId: 'U2',
      type: 'next_action_completed',
      nextActions: [{ key: 'dmv_visit' }],
      createdAt: new Date(now - (2 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E9').set({
      lineUserId: 'U1',
      type: 'task_blocked',
      createdAt: new Date(now - (26 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E10').set({
      lineUserId: 'U1',
      type: 'blocker_resolved',
      createdAt: new Date(now - (2 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E11').set({
      lineUserId: 'U2',
      type: 'CITY_REGION_DECLARED',
      createdAt: new Date(now - (10 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E12').set({
      lineUserId: 'U2',
      type: 'local_task_surface_opened',
      createdAt: new Date(now - (9 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E13').set({
      lineUserId: 'U1',
      type: 'journey_primary_notification_sent',
      createdAt: new Date(now - (5 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E14').set({
      lineUserId: 'U1',
      type: 'notification_fatigue_guarded',
      createdAt: new Date(now - (4 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E15').set({
      lineUserId: 'U1',
      type: 'todo_detail_opened',
      ref: { todoKey: 'insurance' },
      attribution: { notificationId: 'N001', deliveryId: 'D001' },
      createdAt: new Date(now - (3 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E16').set({
      lineUserId: 'U1',
      type: 'todo_detail_section_continue',
      ref: { todoKey: 'insurance', section: 'manual' },
      createdAt: new Date(now - (2.5 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E17').set({
      lineUserId: 'U1',
      type: 'todo_detail_completed',
      ref: { todoKey: 'insurance' },
      attribution: { notificationId: 'N001', deliveryId: 'D001' },
      createdAt: new Date(now - (2 * 24 * 60 * 60 * 1000))
    }, { merge: true });
    await db.collection('events').doc('E18').set({
      lineUserId: 'U1',
      type: 'todo_detail_section_opened',
      ref: { todoKey: 'insurance', section: 'failure' },
      createdAt: new Date(now - (1.5 * 24 * 60 * 60 * 1000))
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
    assert.ok(kpi.nextActionCompletedWithin72hCount >= 1);
    assert.ok(kpi.nextActionCompletion72h > 0);
    assert.ok(kpi.blockerResolutionMedianHours > 0);
    assert.equal(kpi.localTaskOpenRateAfterRegionSet, 1);
    assert.ok(kpi.notificationFatigueRate > 0);
    assert.equal(kpi.detailOpenCount, 1);
    assert.equal(kpi.detailSectionOpenCount, 1);
    assert.equal(kpi.detailContinueCount, 1);
    assert.equal(kpi.detailCompleteCount, 1);
    assert.equal(kpi.detailOpenedAttributedCount, 1);
    assert.equal(kpi.detailCompletedAttributedCount, 1);
    assert.equal(kpi.detailOpenToContinueRate, 1);
    assert.equal(kpi.detailOpenToCompleteRate, 1);
    assert.equal(kpi.detailContinueToCompleteRate, 1);
    assert.equal(kpi.deliveryToDetailToDoneRate, 1);
    assert.equal(kpi.proPromptedCount, 1);
    assert.equal(kpi.proConvertedCount, 1);
    assert.equal(kpi.proConversionRate, 1);
    assert.ok(Object.prototype.hasOwnProperty.call(kpi.churnReasonRatio, 'blocked'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: dashboard keeps pro_active KPI and removes journey detail surface from home', () => {
  const html = require('node:fs').readFileSync('apps/admin/app.html', 'utf8');
  const js = require('node:fs').readFileSync('apps/admin/assets/admin_app.js', 'utf8');

  assert.ok(html.includes('data-dashboard-card="proActive"'));
  assert.ok(html.includes('id="dashboard-summary-open-alerts"'));
  assert.ok(!html.includes('id="dashboard-journey-kpi-reload"'));
  assert.ok(!html.includes('id="dashboard-journey-kpi-result"'));
  assert.ok(js.includes('proActive: { kpiKeys: [\'pro_active_count\']'));
  assert.ok(js.includes('function loadDashboardJourneyKpi(options)'));
  assert.ok(!js.includes('await loadDashboardJourneyKpi({ notify: false });'));
  assert.ok(js.includes('/api/admin/os/journey-kpi'));
});
