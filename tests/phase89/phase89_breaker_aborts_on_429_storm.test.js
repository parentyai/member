'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');
const { computePlanHash } = require('../../src/usecases/phase67/segmentSendHash');
const { createConfirmToken } = require('../../src/domain/confirmToken');

function buildDeps(lineUserIds, plan, opsSpy) {
  return {
    automationRunsRepo: {
      createRun: async () => ({ id: 'run_1' }),
      patchRun: async () => ({ id: 'run_1' }),
      getRun: async () => null
    },
    opsStatesRepo: opsSpy,
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
    sendFn: async () => {
      const err = new Error('LINE API error: 429');
      err.status = 429;
      throw err;
    },
    getKillSwitch: async () => false,
    breakerWindowSize: 3,
    breakerMax429: 2
  };
}

test('phase89: breaker aborts on 429 storm', async () => {
  const lineUserIds = ['U1', 'U2', 'U3'];
  const templateKey = 'ops_alert';
  const bucket = '2026-02-08';
  const planHash = computePlanHash(templateKey, lineUserIds, bucket);
  const plan = {
    snapshot: { serverTimeBucket: bucket, segmentKey: 'seg1', filterSnapshot: {} },
    payloadSummary: { planHash, count: lineUserIds.length, templateVersion: null },
    createdAt: '2026-02-08T00:00:00Z'
  };

  let upserted = null;
  const opsSpy = { upsertOpsState: async (lineUserId, payload) => { upserted = { lineUserId, payload }; } };

  const now = new Date('2026-02-08T00:00:00.000Z');
  const confirmTokenSecret = 'test-confirm-secret';
  const confirmToken = createConfirmToken({
    planHash,
    templateKey,
    templateVersion: null,
    segmentKey: 'seg1'
  }, { now, secret: confirmTokenSecret });

  const deps = buildDeps(lineUserIds, plan, opsSpy);
  deps.now = now;
  deps.confirmTokenSecret = confirmTokenSecret;
  const result = await executeSegmentSend({
    templateKey,
    segmentQuery: {},
    planHash,
    confirmToken,
    breakerWindowSize: 3,
    breakerMax429: 2
  }, deps);

  assert.strictEqual(result.runSummary.status, 'ABORTED');
  assert.ok(upserted);
  assert.strictEqual(upserted.payload.nextAction, 'STOP_AND_ESCALATE');
});
