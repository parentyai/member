'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const crypto = require('crypto');
const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const templatesVRepo = require('../../repos/firestore/templatesVRepo');
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

function resolveTemplateVersion(plan) {
  if (!plan) return null;
  if (plan.payloadSummary && typeof plan.payloadSummary.templateVersion === 'number') {
    return plan.payloadSummary.templateVersion;
  }
  if (plan.snapshot && typeof plan.snapshot.templateVersion === 'number') {
    return plan.snapshot.templateVersion;
  }
  return null;
}

function resolveSegmentKey(plan, payload) {
  if (payload && payload.segmentKey) return payload.segmentKey;
  if (plan && plan.snapshot && typeof plan.snapshot.segmentKey === 'string') return plan.snapshot.segmentKey;
  return null;
}

function resolveFilterSnapshot(plan, payload) {
  if (payload && payload.filterSnapshot) return payload.filterSnapshot;
  if (plan && plan.snapshot && plan.snapshot.filterSnapshot) return plan.snapshot.filterSnapshot;
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
  const content = template.content && typeof template.content === 'object' ? template.content : null;
  if (content) {
    if (typeof content.body === 'string' && content.body.length > 0) return content.body;
    if (typeof content.title === 'string') return content.title;
    if (typeof content.text === 'string') return content.text;
  }
  if (typeof template.body === 'string' && template.body.length > 0) return template.body;
  if (typeof template.title === 'string') return template.title;
  if (typeof template.text === 'string') return template.text;
  return '';
}

function parseTemplateVersion(value) {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) throw new Error('invalid templateVersion');
  return Math.floor(num);
}

async function executeSegmentSend(params, deps) {
  const payload = params || {};
  const templateKey = payload.templateKey;
  if (!templateKey) throw new Error('templateKey required');

  const requestedBy = payload.requestedBy || 'unknown';
  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;
  const templatesV = deps && deps.templatesVRepo ? deps.templatesVRepo : templatesVRepo;
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

  const segmentQuery = payload.segmentQuery || payload.filterSnapshot || {};
  const segment = await segmentFn(segmentQuery, deps);
  const lineUserIds = normalizeLineUserIds(segment.items);
  const payloadPlanHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const payloadTemplateVersion = parseTemplateVersion(payload.templateVersion);
  const count = lineUserIds.length;

  const latestPlan = await auditRepo.getLatestAuditLog({
    action: 'segment_send.plan',
    templateKey
  });
  const expectedHash = resolvePlanHash(latestPlan);
  const expectedCount = resolvePlanCount(latestPlan);
  const expectedBucket = resolvePlanBucket(latestPlan);
  const expectedTemplateVersion = resolveTemplateVersion(latestPlan);
  const planHash = computePlanHash(templateKey, lineUserIds, expectedBucket || resolveDateBucket(new Date()));

  if (!expectedHash || expectedCount === null || !expectedBucket) {
    return { ok: false, reason: 'plan_missing' };
  }
  if (payloadPlanHash && payloadPlanHash !== expectedHash) {
    return { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash: expectedHash };
  }
  if (expectedTemplateVersion !== payloadTemplateVersion) {
    return { ok: false, reason: 'template_version_mismatch', expectedTemplateVersion };
  }
  if (expectedHash !== planHash || expectedCount !== count) {
    return {
      ok: false,
      reason: 'plan_mismatch',
      expectedPlanHash: expectedHash,
      expectedCount
    };
  }

  let template = null;
  if (expectedTemplateVersion !== null) {
    template = await templatesV.getTemplateByVersion({ templateKey, version: expectedTemplateVersion });
  } else {
    template = await templateRepo.getTemplateByKey(templateKey);
  }
  if (!template) throw new Error('template not found');
  if (template.status && template.status === 'inactive') {
    return { ok: false, reason: 'template_inactive' };
  }

  const failures = [];
  let executedCount = 0;
  let queueEnqueuedCount = 0;
  const text = resolveTemplateText(template);
  const segmentKey = resolveSegmentKey(latestPlan, payload);
  const filterSnapshot = resolveFilterSnapshot(latestPlan, payload);
  const runId = crypto.randomUUID();

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
            templateVersion: expectedTemplateVersion,
            text,
            notificationId: templateKey
          },
          reason: errorMessage,
          status: 'PENDING'
        });
        queueEnqueuedCount += 1;
      } catch (_queueErr) {
        // best-effort: queue failures should not block execution
      }
    }
  }

  const serverTime = new Date().toISOString();
  const planSnapshot = {
    count,
    sampleLineUserIds: lineUserIds.slice(0, 5)
  };
  await auditRepo.appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.execute',
    entityType: 'segment_send',
    entityId: templateKey,
    templateKey,
    planHash,
    payloadSummary: {
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      executedCount,
      failures: failures.length,
      queueEnqueuedCount,
      runId
    },
    snapshot: {
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      filterSnapshot,
      planHash,
      planSnapshot,
      executedCount,
      failures,
      queueEnqueuedCount,
      runId,
      serverTime
    }
  });

  return {
    ok: failures.length === 0,
    serverTime,
    runId,
    templateKey,
    templateVersion: expectedTemplateVersion,
    executedCount,
    failures
  };
}

module.exports = {
  executeSegmentSend
};
