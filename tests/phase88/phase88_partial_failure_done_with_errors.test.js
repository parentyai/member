'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');
const { computePlanHash } = require('../../src/usecases/phase67/segmentSendHash');
const { createConfirmToken } = require('../../src/domain/confirmToken');

function buildDeps(lineUserIds, plan) {
  return {
    automationRunsRepo: {
      createRun: async () => ({ id: 'run_1' }),
      patchRun: async () => ({ id: 'run_1' }),
      getRun: async () => null
    },
    opsStatesRepo: { upsertOpsState: async () => {} },
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE' }),
      normalizePhase48Config: () => ({ mode: 'EXECUTE' })
    },
    auditLogsRepo: {
      getLatestAuditLog: async () => plan,
      appendAuditLog: async () => {}
    },
    rateLimiter: async () => {},
    retryPolicy: { shouldRetry: () => false, getDelayMs: () => 0, maxRetries: 0 },
    buildSendSegment: async () => ({ ok: true, items: lineUserIds.map((id) => ({ lineUserId: id })) }),
    notificationTemplatesRepo: { getTemplateByKey: async () => ({ key: 'ops_alert', body: 'hi', status: 'active' }) },
    templatesVRepo: { getTemplateByVersion: async () => null },
    sendRetryQueueRepo: { enqueueFailure: async () => {} },
    sendFn: async ({ lineUserId }) => {
      if (lineUserId === 'U2') {
        const err = new Error('LINE API error: 500');
        err.status = 500;
        throw err;
      }
    },
    getKillSwitch: async () => false,
    circuitBreaker: { record: () => ({ aborted: false }) }
  };
}

test('phase88: partial failure yields DONE_WITH_ERRORS', async () => {
  const lineUserIds = ['U1', 'U2', 'U3'];
  const templateKey = 'ops_alert';
  const bucket = '2026-02-08';
  const planHash = computePlanHash(templateKey, lineUserIds, bucket);
  const plan = {
    snapshot: { serverTimeBucket: bucket, segmentKey: 'seg1', filterSnapshot: {} },
    payloadSummary: { planHash, count: lineUserIds.length, templateVersion: null },
    createdAt: '2026-02-08T00:00:00Z'
  };

  const now = new Date('2026-02-08T00:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const confirmToken = createConfirmToken({
    planHash,
    templateKey,
    templateVersion: null,
    segmentKey: 'seg1'
  }, { now, secret: confirmTokenSecret });

  const deps = buildDeps(lineUserIds, plan);
  deps.now = now;
  deps.confirmTokenSecret = confirmTokenSecret;
  const result = await executeSegmentSend({ templateKey, segmentQuery: {}, planHash, confirmToken }, deps);
  assert.strictEqual(result.runSummary.status, 'DONE_WITH_ERRORS');
  assert.strictEqual(result.failures.length, 1);
});
