'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { getTraceBundle, buildTraceJoinSummary } = require('../../src/usecases/admin/getTraceBundle');

test('phase807: trace bundle adds cross-system joins without removing legacy sections', async () => {
  const bundle = await getTraceBundle({ traceId: 'TRACE_V2', limit: 20 }, {
    auditLogsRepo: {
      listAuditLogsByTraceId: async () => [
        { action: 'faq.answer', traceId: 'TRACE_V2' },
        { action: 'city_pack.publish', traceId: 'TRACE_V2' },
        { action: 'emergency.dispatch', traceId: 'TRACE_V2' }
      ]
    },
    decisionLogsRepo: {
      listDecisionsByTraceId: async () => [{ id: 'decision-1', traceId: 'TRACE_V2' }]
    },
    decisionTimelineRepo: {
      listTimelineEntriesByTraceId: async () => [{ id: 'timeline-1', traceId: 'TRACE_V2' }]
    },
    llmActionLogsRepo: {
      listLlmActionLogsByTraceId: async () => [{
        traceId: 'TRACE_V2',
        emergencyContextActive: true,
        cityPackGrounded: true,
        cityPackFreshnessScore: 0.93,
        savedFaqReused: true,
        taskBlockerDetected: true,
        journeyPhase: 'phase_a',
        sourceSnapshotRefs: ['snapshot:1']
      }]
    },
    sourceEvidenceRepo: {
      listEvidenceByTraceId: async () => [{ id: 'ev-1', traceId: 'TRACE_V2' }]
    },
    faqAnswerLogsRepo: {
      listFaqAnswerLogsByTraceId: async () => [{ id: 'faq-1', traceId: 'TRACE_V2' }]
    },
    emergencyEventsRepo: {
      listEventsByTraceId: async () => [{ id: 'event-1', traceId: 'TRACE_V2' }]
    },
    emergencyBulletinsRepo: {
      listBulletinsByTraceId: async () => [{ id: 'bulletin-1', traceId: 'TRACE_V2' }]
    },
    cityPackBulletinsRepo: {
      listBulletinsByTraceId: async () => [{ id: 'cp-1', traceId: 'TRACE_V2' }]
    },
    taskEventsRepo: {
      listTaskEventsByTraceId: async () => [{ id: 'task-1', traceId: 'TRACE_V2' }]
    },
    journeyBranchQueueRepo: {
      listJourneyBranchItemsByTraceId: async () => [{ id: 'journey-1', traceId: 'TRACE_V2' }]
    }
  });

  assert.equal(bundle.ok, true);
  assert.ok(Array.isArray(bundle.audits));
  assert.ok(Array.isArray(bundle.decisions));
  assert.ok(Array.isArray(bundle.timeline));
  assert.ok(bundle.joins && Array.isArray(bundle.joins.llmActions));
  assert.ok(bundle.joins && Array.isArray(bundle.joins.sourceEvidence));
  assert.ok(bundle.joins && bundle.joins.emergency && Array.isArray(bundle.joins.emergency.events));
  assert.ok(bundle.joins && bundle.joins.cityPack && Array.isArray(bundle.joins.cityPack.bulletins));
  assert.ok(bundle.joins && bundle.joins.journey && Array.isArray(bundle.joins.journey.taskEvents));
  assert.equal(bundle.traceJoinSummary.completeness, 1);
  assert.ok(bundle.traceJoinSummary.joinedDomains.includes('cityPack'));
  assert.ok(bundle.traceJoinSummary.joinedDomains.includes('emergency'));
  assert.ok(bundle.traceJoinSummary.joinedDomains.includes('journey'));
  assert.deepEqual(bundle.traceJoinSummary.missingDomains, []);
});

test('phase807: trace join summary flags inferred but missing auxiliary domains', () => {
  const summary = buildTraceJoinSummary({
    audits: [{ action: 'city_pack.publish' }],
    decisions: [],
    timeline: [],
    llmActions: [{
      emergencyContextActive: true,
      cityPackGrounded: true,
      savedFaqReused: true,
      taskBlockerDetected: true,
      journeyPhase: 'phase_b',
      sourceSnapshotRefs: ['snapshot:1']
    }],
    sourceEvidence: [],
    faqAnswerLogs: [],
    emergencyEvents: [],
    emergencyBulletins: [],
    cityPackBulletins: [],
    taskEvents: [],
    journeyBranchQueue: []
  });

  assert.ok(summary.expectedDomains.includes('sourceEvidence'));
  assert.ok(summary.expectedDomains.includes('faq'));
  assert.ok(summary.expectedDomains.includes('emergency'));
  assert.ok(summary.expectedDomains.includes('cityPack'));
  assert.ok(summary.expectedDomains.includes('journey'));
  assert.ok(summary.missingDomains.includes('sourceEvidence'));
  assert.ok(summary.missingDomains.includes('emergency'));
  assert.ok(summary.criticalMissingDomains.includes('journey'));
  assert.ok(summary.completeness < 1);
});
