'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');
const { computePlanHash } = require('../../src/usecases/phase67/segmentSendHash');
const { createConfirmToken } = require('../../src/domain/confirmToken');

function buildDeps(lineUserIds, plan) {
  const patchCalls = [];
  const runStore = {};
  const runRepo = {
    createRun: async (payload) => {
      const id = 'run_1';
      runStore[id] = Object.assign({ id }, payload);
      return { id };
    },
    patchRun: async (id, patch) => {
      patchCalls.push(patch);
      runStore[id] = Object.assign(runStore[id] || { id }, patch);
      return { id };
    },
    getRun: async (id) => runStore[id] || null
  };

  return {
    patchCalls,
    deps: {
      automationRunsRepo: runRepo,
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
      sendFn: async () => {},
      getKillSwitch: async () => false
    }
  };
}

test('phase86: batching updates progress cursor', async () => {
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

  const { patchCalls, deps } = buildDeps(lineUserIds, plan);
  deps.now = now;
  deps.confirmTokenSecret = confirmTokenSecret;
  await executeSegmentSend({ templateKey, segmentQuery: {}, planHash, confirmToken, batchSize: 2 }, deps);

  const cursorPatch = patchCalls.find((call) => call.cursor && call.cursor.index === 2);
  assert.ok(cursorPatch, 'expected cursor patch at index 2');
});
