'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  REPLAY_VERSION,
  buildReplayEvent,
  buildTrustedWebhookBody,
  validateTrustedWebhookBody,
  replaySameTrafficSet
} = require('../../tools/quality_patrol/replay_same_traffic_set');

function noopSleep() {
  return Promise.resolve();
}

test('phase856: replay harness enforces trusted webhook body shape', () => {
  const event = buildReplayEvent({
    requestId: 'req_001',
    lineUserId: 'U1234567890',
    text: '最初の一歩を教えてください',
    timestamp: 1_700_000_000_000
  });
  const payload = buildTrustedWebhookBody(event, { destination: 'debug' });
  assert.deepEqual(payload, {
    destination: 'debug',
    events: [event]
  });
  assert.deepEqual(validateTrustedWebhookBody(payload), payload);
});

test('phase856: replay harness rejects malformed single-event payloads with diagnostic code', () => {
  assert.throws(
    () => validateTrustedWebhookBody({ destination: 'debug', events: { type: 'message' } }),
    (error) => error && error.code === 'invalid_trusted_payload_shape'
  );
  assert.throws(
    () => validateTrustedWebhookBody({ destination: '', events: [{}] }),
    (error) => error && error.code === 'invalid_trusted_payload_destination'
  );
});

test('phase856: replay harness writes deterministic per-event replay result shape', async () => {
  const actionRows = new Map();
  const persistedTraces = new Map();
  const snapshotCounts = new Map();
  const requestIds = [];

  const result = await replaySameTrafficSet({
    userId: 'U3037952f2f6531a3d8b24fd13ca3c680',
    messages: ['a', 'b', 'c', 'd', 'e'],
    output: '/tmp/phase856_replay_contract.json',
    prefix: 'phase856_replay',
    pollAttempts: 1,
    pollIntervalMs: 1
  }, {
    handleLineWebhook: async ({ trustedPayload, requestId, traceId, replyFn }) => {
      validateTrustedWebhookBody(trustedPayload);
      requestIds.push(requestId);
      const persistedTraceKey = `${traceId}_persisted`;
      persistedTraces.set(requestId, persistedTraceKey);
      snapshotCounts.set(traceId, 0);
      snapshotCounts.set(persistedTraceKey, 1);
      actionRows.set(requestId, {
        requestId,
        traceId: persistedTraceKey,
        transcriptSnapshotOutcome: 'written',
        transcriptSnapshotReason: null,
        transcriptSnapshotAssistantReplyPresent: true,
        transcriptSnapshotAssistantReplyLength: 18,
        transcriptSnapshotSanitizedReplyLength: 18,
        transcriptSnapshotBuildAttempted: true,
        transcriptSnapshotBuildSkippedReason: null
      });
      await replyFn('reply', { type: 'text', text: 'stub reply' });
      return { status: 200 };
    },
    listLlmActionLogsByLineUserId: async () => Array.from(actionRows.values()),
    listConversationReviewSnapshotsByTraceId: async ({ traceId }) => Array.from({ length: snapshotCounts.get(traceId) || 0 }, (_, index) => ({ id: `${traceId}_${index}` })),
    buildConversationReviewUnitsFromSources: async ({ fromAt, toAt }) => ({
      reviewUnits: Array.from({ length: 5 }, (_, index) => ({ reviewUnitId: `ru_${index}` })),
      sourceWindow: { fromAt, toAt },
      transcriptCoverage: {
        observedCount: 5,
        transcriptWriteOutcomeCounts: {
          written: 5,
          skipped_unreviewable_transcript: 0
        },
        snapshotInputDiagnostics: {
          assistant_reply_missing: 0
        }
      },
      joinDiagnostics: {
        faqOnlyRowsSkipped: 0,
        traceHydrationLimitedCount: 0
      }
    }),
    queryLatestPatrolInsights: async ({ audience }) => ({
      traceRefs: audience === 'operator' ? [{ traceId: 'trace_1' }, { traceId: 'trace_2' }] : [],
      observationBlockers: []
    }),
    sleep: noopSleep
  });

  assert.equal(result.replayVersion, REPLAY_VERSION);
  assert.equal(result.replayCount, 5);
  assert.equal(result.events.length, 5);
  assert.equal(result.events[0].requestId, requestIds[0]);
  assert.equal(result.events[0].persistedTraceKey, `${result.events[0].suppliedTraceId}_persisted`);
  assert.equal(result.events[0].transcriptSnapshotOutcome, 'written');
  assert.equal(result.events[0].snapshotRowsBySuppliedTraceId, 0);
  assert.equal(result.events[0].snapshotRowsByPersistedTraceKey, 1);
  assert.equal(result.recentSummary.ok, true);
  assert.equal(result.recentSummary.written, 5);
  assert.equal(result.recentSummary.operatorTraceRefs, 2);
  assert.equal(result.writePath.rawPersistenceAdded, false);
});
