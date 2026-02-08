'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { executeSegmentSend } = require('../../src/usecases/phase68/executeSegmentSend');
const { computePlanHash } = require('../../src/usecases/phase67/segmentSendHash');

function buildPlan(templateKey, lineUserIds, bucket) {
  return {
    snapshot: { serverTimeBucket: bucket, segmentKey: 'seg1', filterSnapshot: {} },
    payloadSummary: { planHash: computePlanHash(templateKey, lineUserIds, bucket), count: lineUserIds.length, templateVersion: null },
    createdAt: '2026-02-08T00:00:00Z'
  };
}

function buildDeps(lineUserIds, plan, auditEntries, sendFn) {
  return {
    automationRunsRepo: {
      createRun: async () => ({ id: `run_${auditEntries.length}` }),
      patchRun: async () => ({ id: `run_${auditEntries.length}` }),
      getRun: async () => null
    },
    opsStatesRepo: { upsertOpsState: async () => {} },
    automationConfigRepo: {
      getLatestAutomationConfig: async () => ({ mode: 'EXECUTE' }),
      normalizePhase48Config: () => ({ mode: 'EXECUTE' })
    },
    auditLogsRepo: {
      getLatestAuditLog: async () => plan,
      appendAuditLog: async (entry) => { auditEntries.push(entry); }
    },
    rateLimiter: async () => {},
    retryPolicy: { shouldRetry: () => false, getDelayMs: () => 0, maxRetries: 0 },
    buildSendSegment: async () => ({ ok: true, items: lineUserIds.map((id) => ({ lineUserId: id })) }),
    notificationTemplatesRepo: { getTemplateByKey: async () => ({ key: 'ops_alert', body: 'hi', status: 'active' }) },
    templatesVRepo: { getTemplateByVersion: async () => null },
    sendRetryQueueRepo: { enqueueFailure: async () => {} },
    sendFn,
    getKillSwitch: async () => false
  };
}

test('phase91: audit logs appended on start/done/abort', async () => {
  const templateKey = 'ops_alert';
  const lineUserIds = ['U1', 'U2'];
  const bucket = '2026-02-08';
  const plan = buildPlan(templateKey, lineUserIds, bucket);
  const planHash = plan.payloadSummary.planHash;

  const auditEntries = [];
  await executeSegmentSend({ templateKey, segmentQuery: {}, planHash }, buildDeps(lineUserIds, plan, auditEntries, async () => {}));

  await executeSegmentSend({
    templateKey,
    segmentQuery: {},
    planHash,
    breakerWindowSize: 2,
    breakerMax429: 1
  }, buildDeps(lineUserIds, plan, auditEntries, async () => {
    const err = new Error('LINE API error: 429');
    err.status = 429;
    throw err;
  }));

  const kinds = auditEntries.filter((entry) => entry.action === 'automation_run').map((entry) => entry.kind);
  assert.ok(kinds.includes('RUN_START'));
  assert.ok(kinds.includes('RUN_DONE'));
  assert.ok(kinds.includes('RUN_ABORT'));
});
