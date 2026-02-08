'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { testSendNotification } = require('../notifications/testSendNotification');
const { buildSendSegment } = require('../phase66/buildSendSegment');
const { normalizeLineUserIds, computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');

function resolvePlanHash(plan) {
  if (!plan) return null;
  if (typeof plan.planHash === 'string') return plan.planHash;
  if (plan.payloadSummary && typeof plan.payloadSummary.planHash === 'string') return plan.payloadSummary.planHash;
  if (plan.snapshot && typeof plan.snapshot.planHash === 'string') return plan.snapshot.planHash;
  return null;
}

function resolvePlanCount(plan) {
  if (!plan) return null;
  if (typeof plan.count === 'number') return plan.count;
  if (plan.payloadSummary && typeof plan.payloadSummary.count === 'number') return plan.payloadSummary.count;
  if (plan.snapshot && typeof plan.snapshot.count === 'number') return plan.snapshot.count;
  return null;
}

function resolveDateFromValue(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function resolvePlanBucket(plan) {
  if (!plan) return null;
  if (plan.snapshot && typeof plan.snapshot.serverTimeBucket === 'string') return plan.snapshot.serverTimeBucket;
  if (plan.payloadSummary && typeof plan.payloadSummary.serverTimeBucket === 'string') return plan.payloadSummary.serverTimeBucket;
  const snapshotTime = plan.snapshot && plan.snapshot.serverTime ? resolveDateFromValue(plan.snapshot.serverTime) : null;
  if (snapshotTime) return resolveDateBucket(snapshotTime);
  const createdAt = resolveDateFromValue(plan.createdAt);
  if (createdAt) return resolveDateBucket(createdAt);
  return null;
}

function resolveTemplateText(template) {
  if (!template || typeof template !== 'object') return '';
  if (typeof template.body === 'string' && template.body.length > 0) return template.body;
  if (typeof template.title === 'string') return template.title;
  if (typeof template.text === 'string') return template.text;
  return '';
}

async function executeSegmentSend(params, deps) {
  const payload = params || {};
  const templateKey = payload.templateKey;
  if (!templateKey) throw new Error('templateKey required');

  const requestedBy = payload.requestedBy || 'unknown';
  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const retryQueueRepo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const segmentFn = deps && deps.buildSendSegment ? deps.buildSendSegment : buildSendSegment;
  const sendFn = deps && deps.sendFn ? deps.sendFn : testSendNotification;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;

  const storedConfig = await configRepo.getLatestAutomationConfig();
  const normalizedConfig = configRepo.normalizePhase48Config(storedConfig);
  if (normalizedConfig.mode !== 'EXECUTE') {
    return { ok: false, reason: 'automation_mode_not_execute', mode: normalizedConfig.mode };
  }

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    return { ok: false, reason: 'kill_switch_on' };
  }

  const template = await templateRepo.getTemplateByKey(templateKey);
  if (!template) throw new Error('template not found');
  if (template.status && template.status === 'inactive') {
    return { ok: false, reason: 'template_inactive' };
  }

  const segment = await segmentFn(payload.segmentQuery || {}, deps);
  const lineUserIds = normalizeLineUserIds(segment.items);
  const payloadPlanHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const count = lineUserIds.length;

  const latestPlan = await auditRepo.getLatestAuditLog({
    action: 'segment_send.plan',
    templateKey
  });
  const expectedHash = resolvePlanHash(latestPlan);
  const expectedCount = resolvePlanCount(latestPlan);
  const expectedBucket = resolvePlanBucket(latestPlan);
  const planHash = computePlanHash(templateKey, lineUserIds, expectedBucket || resolveDateBucket(new Date()));

  if (!expectedHash || expectedCount === null || !expectedBucket) {
    return { ok: false, reason: 'plan_missing' };
  }
  if (payloadPlanHash && payloadPlanHash !== expectedHash) {
    return { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash: expectedHash };
  }
  if (expectedHash !== planHash || expectedCount !== count) {
    return {
      ok: false,
      reason: 'plan_mismatch',
      expectedPlanHash: expectedHash,
      expectedCount
    };
  }

  const failures = [];
  let executedCount = 0;
  const text = resolveTemplateText(template);

  for (const lineUserId of lineUserIds) {
    try {
      await sendFn({
        lineUserId,
        text,
        notificationId: templateKey,
        killSwitch
      }, deps);
      executedCount += 1;
    } catch (err) {
      const errorMessage = err && err.message ? err.message : 'send_failed';
      failures.push({ lineUserId, error: errorMessage });
      try {
        await retryQueueRepo.enqueueFailure({
          lineUserId,
          templateKey,
          payloadSnapshot: {
            lineUserId,
            templateKey,
            text,
            notificationId: templateKey
          },
          reason: errorMessage,
          status: 'PENDING'
        });
      } catch (_queueErr) {
        // best-effort: queue failures should not block execution
      }
    }
  }

  const serverTime = new Date().toISOString();
  await auditRepo.appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.execute',
    entityType: 'segment_send',
    entityId: templateKey,
    templateKey,
    planHash,
    payloadSummary: {
      templateKey,
      executedCount,
      failures: failures.length
    },
    snapshot: {
      templateKey,
      planHash,
      executedCount,
      failures,
      serverTime
    }
  });

  return {
    ok: failures.length === 0,
    serverTime,
    templateKey,
    executedCount,
    failures
  };
}

module.exports = {
  executeSegmentSend
};
