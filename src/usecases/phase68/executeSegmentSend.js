'use strict';

const automationConfigRepo = require('../../repos/firestore/automationConfigRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const automationRunsRepo = require('../../repos/firestore/automationRunsRepo');
const crypto = require('crypto');
const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const opsStatesRepo = require('../../repos/firestore/opsStatesRepo');
const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const templatesVRepo = require('../../repos/firestore/templatesVRepo');
const { createCircuitBreaker } = require('../../domain/circuitBreaker');
const { createRateLimiter } = require('../../domain/rateLimiter');
const { createRetryPolicy } = require('../../domain/retryPolicy');
const { testSendNotification } = require('../notifications/testSendNotification');
const { computeSegmentRunDeliveryId } = require('../../domain/deliveryId');
const { buildSendSegment } = require('../phase66/buildSendSegment');
const { normalizeLineUserIds, computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');
const { verifyConfirmToken } = require('../../domain/confirmToken');
const { evaluateNotificationPolicy, resolveNotificationCategoryFromTemplate } = require('../../domain/notificationPolicy');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');

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

function parsePositiveInt(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return fallback;
  return Math.floor(num);
}

function computeConfirmTokenId(token) {
  if (!token || typeof token !== 'string') return null;
  return crypto.createHash('sha256').update(token).digest('hex').slice(0, 12);
}

function resolveMainSha(payload) {
  if (payload && typeof payload.mainSha === 'string' && payload.mainSha.length > 0) return payload.mainSha;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  return null;
}

function buildRunCounters(run, total) {
  const counters = Object.assign({ total, attempted: 0, success: 0, failed: 0, skipped: 0 }, run && run.counters);
  counters.total = total;
  return counters;
}

async function executeSegmentSend(params, deps) {
  const payload = params || {};
  const templateKey = payload.templateKey;
  if (!templateKey) throw new Error('templateKey required');

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const requestedBy = payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const configRepo = deps && deps.automationConfigRepo ? deps.automationConfigRepo : automationConfigRepo;
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;
  const templatesV = deps && deps.templatesVRepo ? deps.templatesVRepo : templatesVRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const retryQueueRepo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const segmentFn = deps && deps.buildSendSegment ? deps.buildSendSegment : buildSendSegment;
  const sendFn = deps && deps.sendFn ? deps.sendFn : testSendNotification;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;

  async function appendRejectAudit(reason, extra) {
    try {
      await auditRepo.appendAuditLog({
        actor: requestedBy,
        action: 'segment_send.execute',
        entityType: 'segment_send',
        entityId: templateKey,
        templateKey,
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: Object.assign({ ok: false, reason, templateKey }, extra || {})
      });
    } catch (_err) {
      // best-effort only
    }
  }

  const storedConfig = await configRepo.getLatestAutomationConfig();
  const normalizedConfig = configRepo.normalizePhase48Config(storedConfig);
  if (normalizedConfig.mode !== 'EXECUTE') {
    await appendRejectAudit('automation_mode_not_execute', { mode: normalizedConfig.mode || null });
    return { ok: false, reason: 'automation_mode_not_execute', mode: normalizedConfig.mode };
  }

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    await appendRejectAudit('kill_switch_on', {});
    return { ok: false, reason: 'kill_switch_on' };
  }

  const segmentQuery = payload.segmentQuery || payload.filterSnapshot || {};
  const segment = await segmentFn(segmentQuery, deps);
  const lineUserIds = normalizeLineUserIds(segment.items);
  const payloadPlanHash = typeof payload.planHash === 'string' && payload.planHash.trim().length > 0
    ? payload.planHash.trim()
    : null;
  const payloadTemplateVersion = parseTemplateVersion(payload.templateVersion);
  const confirmToken = typeof payload.confirmToken === 'string' && payload.confirmToken.trim().length > 0
    ? payload.confirmToken.trim()
    : null;
  const count = lineUserIds.length;

  const latestPlan = await auditRepo.getLatestAuditLog({
    action: 'segment_send.plan',
    templateKey
  });
  const expectedHash = resolvePlanHash(latestPlan);
  const expectedCount = resolvePlanCount(latestPlan);
  const expectedBucket = resolvePlanBucket(latestPlan);
  const expectedTemplateVersion = resolveTemplateVersion(latestPlan);
  const planHash = computePlanHash(templateKey, lineUserIds, expectedBucket || resolveDateBucket(now));

  if (!expectedHash || expectedCount === null || !expectedBucket) {
    await appendRejectAudit('plan_missing', {});
    return { ok: false, reason: 'plan_missing' };
  }
  if (!payloadPlanHash) {
    await appendRejectAudit('plan_hash_required', {});
    return { ok: false, reason: 'plan_hash_required', status: 400 };
  }
  if (payloadPlanHash && payloadPlanHash !== expectedHash) {
    await appendRejectAudit('plan_hash_mismatch', { expectedPlanHash: expectedHash });
    return { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash: expectedHash };
  }
  if (expectedTemplateVersion !== payloadTemplateVersion) {
    await appendRejectAudit('template_version_mismatch', { expectedTemplateVersion });
    return { ok: false, reason: 'template_version_mismatch', expectedTemplateVersion };
  }
  if (expectedHash !== planHash || expectedCount !== count) {
    await appendRejectAudit('plan_mismatch', { expectedPlanHash: expectedHash, expectedCount });
    return {
      ok: false,
      reason: 'plan_mismatch',
      expectedPlanHash: expectedHash,
      expectedCount
    };
  }

  if (!confirmToken) {
    await appendRejectAudit('confirm_token_required', {});
    return { ok: false, reason: 'confirm_token_required', status: 400 };
  }
  const confirmOk = verifyConfirmToken(confirmToken, {
    planHash: expectedHash,
    templateKey,
    templateVersion: expectedTemplateVersion,
    segmentKey: resolveSegmentKey(latestPlan, payload)
  }, {
    secret: deps && deps.confirmTokenSecret,
    now
  });
  if (!confirmOk) {
    await appendRejectAudit('confirm_token_mismatch', {});
    return { ok: false, reason: 'confirm_token_mismatch', status: 409 };
  }

  let template = null;
  if (expectedTemplateVersion !== null) {
    template = await templatesV.getTemplateByVersion({ templateKey, version: expectedTemplateVersion });
  } else {
    template = await templateRepo.getTemplateByKey(templateKey);
  }
  if (!template) throw new Error('template not found');
  if (template.status && template.status === 'inactive') {
    await appendRejectAudit('template_inactive', {});
    return { ok: false, reason: 'template_inactive' };
  }
  const notificationCategory = resolveNotificationCategoryFromTemplate(template);
  let servicePhase = null;
  let notificationPreset = null;
  let notificationCaps = normalizeNotificationCaps(null);
  try {
    const getServicePhase = deps && deps.getServicePhase ? deps.getServicePhase : systemFlagsRepo.getServicePhase;
    const getNotificationPreset = deps && deps.getNotificationPreset
      ? deps.getNotificationPreset
      : systemFlagsRepo.getNotificationPreset;
    const getNotificationCaps = deps && deps.getNotificationCaps
      ? deps.getNotificationCaps
      : systemFlagsRepo.getNotificationCaps;
    [servicePhase, notificationPreset, notificationCaps] = await Promise.all([
      getServicePhase(),
      getNotificationPreset(),
      getNotificationCaps()
    ]);
  } catch (_err) {
    servicePhase = null;
    notificationPreset = null;
    notificationCaps = normalizeNotificationCaps(null);
  }
  const policyResult = evaluateNotificationPolicy({
    servicePhase,
    notificationPreset,
    notificationCategory
  });
  if (!policyResult.allowed) {
    await appendRejectAudit('notification_policy_blocked', {
      policyReason: policyResult.reason,
      servicePhase: policyResult.servicePhase,
      notificationPreset: policyResult.notificationPreset,
      notificationCategory: policyResult.notificationCategory,
      allowedCategories: policyResult.allowedCategories
    });
    return {
      ok: false,
      reason: 'notification_policy_blocked',
      policyReason: policyResult.reason,
      servicePhase: policyResult.servicePhase,
      notificationPreset: policyResult.notificationPreset,
      notificationCategory: policyResult.notificationCategory
    };
  }

  const runRepo = deps && deps.automationRunsRepo ? deps.automationRunsRepo : automationRunsRepo;
  const opsRepo = deps && deps.opsStatesRepo ? deps.opsStatesRepo : opsStatesRepo;
  const batchSize = parsePositiveInt(payload.batchSize, 50);
  const text = resolveTemplateText(template);
  const segmentKey = resolveSegmentKey(latestPlan, payload);
  const filterSnapshot = resolveFilterSnapshot(latestPlan, payload);
  const confirmTokenId = computeConfirmTokenId(confirmToken);
  const mainSha = resolveMainSha(payload);

  let runId = payload.runId || null;
  let runRecord = null;
  if (runId) {
    runRecord = await runRepo.getRun(runId);
    if (!runRecord) throw new Error('run not found');
  }

  const counters = buildRunCounters(runRecord, count);
  const cursor = runRecord && runRecord.cursor ? runRecord.cursor : { index: 0, lastUserId: null };
  let currentIndex = typeof cursor.index === 'number' && cursor.index >= 0 ? cursor.index : 0;
  let lastUserId = cursor.lastUserId || null;

  const limits = runRecord && runRecord.limits
    ? runRecord.limits
    : {
      batchSize,
      rps: parsePositiveInt(payload.rps, 10),
      maxRetries: parsePositiveInt(payload.maxRetries, 3)
    };
  const effectiveBatchSize = parsePositiveInt(limits.batchSize, batchSize);

  const rateLimiter = deps && deps.rateLimiter
    ? deps.rateLimiter
    : createRateLimiter({
      rps: limits.rps,
      nowFn: deps && deps.nowFn,
      sleepFn: deps && deps.sleepFn
    });
  const retryPolicy = deps && deps.retryPolicy
    ? deps.retryPolicy
    : createRetryPolicy({
      maxRetries: limits.maxRetries,
      baseMs: parsePositiveInt(payload.retryBaseMs, 200),
      factor: parsePositiveInt(payload.retryFactor, 2),
      jitter: typeof payload.retryJitter === 'number' ? payload.retryJitter : 0.1,
      randomFn: deps && deps.randomFn
    });
  const breaker = deps && deps.circuitBreaker
    ? deps.circuitBreaker
    : createCircuitBreaker({
      windowSize: parsePositiveInt(payload.breakerWindowSize, 10),
      max429: parsePositiveInt(payload.breakerMax429, 7),
      max5xx: parsePositiveInt(payload.breakerMax5xx, 7)
    });

  if (!runRecord) {
    const created = await runRepo.createRun({
      kind: 'SEGMENT_SEND',
      status: 'RUNNING',
      segmentKey,
      templateKey,
      templateVersion: expectedTemplateVersion,
      planHash: expectedHash,
      confirmTokenId,
      limits,
      counters,
      cursor: { index: currentIndex, lastUserId },
      lastError: null,
      evidence: { mainSha, ciRunUrl: null, prUrl: null }
    });
    runId = created.id;
    runRecord = Object.assign({ id: runId }, { counters, cursor });
    await auditRepo.appendAuditLog({
      actor: requestedBy,
      action: 'automation_run',
      kind: 'RUN_START',
      runId,
      planHash: expectedHash,
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        runId,
        counters,
        mainSha
      }
    });
  } else {
    await runRepo.patchRun(runId, {
      status: 'RUNNING',
      counters,
      cursor,
      limits
    });
  }

  const failures = [];
  let queueEnqueuedCount = 0;
  let capBlockedCount = 0;
  const capBlockedLineUserIds = [];
  const capBlockedSummary = {};
  let aborted = false;
  let abortReason = null;
  let abortDetail = null;

  async function sendWithRetry(lineUserId) {
    let attempt = 0;
    let lastError = null;
    while (true) {
      await rateLimiter();
      try {
        const deliveryId = runId ? computeSegmentRunDeliveryId({ runId, lineUserId }) : null;
        await sendFn({
          lineUserId,
          text,
          notificationId: templateKey,
          killSwitch,
          deliveryId,
          notificationCategory: notificationCategory || null
        }, deps);
        return { ok: true, attempts: attempt + 1, error: null };
      } catch (err) {
        lastError = err;
        if (!retryPolicy.shouldRetry(err, attempt)) {
          return { ok: false, attempts: attempt + 1, error: err };
        }
        const delayMs = retryPolicy.getDelayMs(attempt);
        if (delayMs > 0) {
          if (deps && typeof deps.sleepFn === 'function') {
            await deps.sleepFn(delayMs);
          } else {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
        }
        attempt += 1;
      }
    }
  }

  for (let index = currentIndex; index < lineUserIds.length; index += 1) {
    const lineUserId = lineUserIds[index];
    const capResult = await checkNotificationCap({
      lineUserId,
      now,
      notificationCaps,
      notificationCategory: notificationCategory || null
    }, {
      countDeliveredByUserSince: deps && deps.countDeliveredByUserSince
        ? deps.countDeliveredByUserSince
        : undefined,
      countDeliveredByUserCategorySince: deps && deps.countDeliveredByUserCategorySince
        ? deps.countDeliveredByUserCategorySince
        : undefined
    });
    if (!capResult.allowed) {
      counters.attempted += 1;
      counters.skipped += 1;
      capBlockedCount += 1;
      if (capBlockedLineUserIds.length < 50) capBlockedLineUserIds.push(lineUserId);
      const key = `${capResult.capType || 'UNKNOWN'}:${capResult.reason || 'unknown'}`;
      capBlockedSummary[key] = (capBlockedSummary[key] || 0) + 1;
      continue;
    }

    const result = await sendWithRetry(lineUserId);
    counters.attempted += 1;
    lastUserId = lineUserId;
    if (result.ok) {
      counters.success += 1;
    } else {
      const errorMessage = result.error && result.error.message ? result.error.message : 'send_failed';
      counters.failed += 1;
      failures.push({ lineUserId, error: errorMessage });
      try {
        const deliveryId = runId ? computeSegmentRunDeliveryId({ runId, lineUserId }) : null;
        await retryQueueRepo.enqueueFailure({
          lineUserId,
          templateKey,
          payloadSnapshot: {
            lineUserId,
            templateKey,
            templateVersion: expectedTemplateVersion,
            text,
            notificationId: templateKey,
            notificationCategory: notificationCategory || null,
            deliveryId
          },
          reason: errorMessage,
          status: 'PENDING'
        });
        queueEnqueuedCount += 1;
      } catch (_queueErr) {
        // best-effort: queue failures should not block execution
      }
    }

    const breakerState = breaker.record(result.error || null);
    if (breakerState.aborted) {
      aborted = true;
      abortReason = breakerState.reason;
      abortDetail = breakerState;
      currentIndex = index + 1;
      break;
    }

    if ((index + 1) % effectiveBatchSize === 0) {
      currentIndex = index + 1;
      await runRepo.patchRun(runId, {
        status: 'RUNNING',
        counters,
        cursor: { index: currentIndex, lastUserId }
      });
    }
  }

  const serverTime = new Date().toISOString();
  const planSnapshot = {
    count,
    sampleLineUserIds: lineUserIds.slice(0, 5)
  };

  if (aborted) {
    await runRepo.patchRun(runId, {
      status: 'ABORTED',
      counters,
      cursor: { index: currentIndex, lastUserId },
      lastError: { code: abortReason, message: 'circuit breaker tripped' }
    });
    await auditRepo.appendAuditLog({
      actor: requestedBy,
      action: 'automation_run',
      kind: 'RUN_ABORT',
      runId,
      planHash: expectedHash,
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        runId,
        counters,
        mainSha,
        reason: abortReason
      }
    });
    if (lastUserId) {
      try {
        await opsRepo.upsertOpsState(lastUserId, {
          nextAction: 'STOP_AND_ESCALATE',
          failure_class: 'ENV',
          reasonCode: 'AUTOMATION_ABORTED',
          stage: 'EXECUTE',
          note: abortReason
        });
      } catch (_err) {
        // best-effort: ops state update should not block
      }
    }
  } else {
    await runRepo.patchRun(runId, {
      status: counters.failed > 0 ? 'DONE_WITH_ERRORS' : 'DONE',
      counters,
      cursor: { index: lineUserIds.length, lastUserId }
    });
    await auditRepo.appendAuditLog({
      actor: requestedBy,
      action: 'automation_run',
      kind: 'RUN_DONE',
      runId,
      planHash: expectedHash,
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        runId,
        counters,
        mainSha
      }
    });
  }

  await auditRepo.appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.execute',
    entityType: 'segment_send',
    entityId: templateKey,
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    templateKey,
    planHash,
    payloadSummary: {
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      executedCount: counters.success,
      capBlockedCount,
      capBlockedSummary,
      failures: failures.length,
      queueEnqueuedCount,
      runId,
      confirmTokenId,
      notificationCategory: notificationCategory || null
    },
    snapshot: {
      templateKey,
      templateVersion: expectedTemplateVersion,
      segmentKey,
      notificationCategory: notificationCategory || null,
      filterSnapshot,
      planHash,
      confirmTokenId,
      planSnapshot,
      executedCount: counters.success,
      capBlockedCount,
      capBlockedLineUserIds,
      capBlockedSummary,
      failures,
      queueEnqueuedCount,
      runId,
      serverTime,
      runSummary: {
        status: aborted ? 'ABORTED' : (counters.failed > 0 ? 'DONE_WITH_ERRORS' : 'DONE'),
        counters,
        abortDetail: abortDetail || null
      }
    }
  });

  return {
    ok: !aborted && failures.length === 0 && !(capBlockedCount > 0 && counters.success === 0),
    reason: !aborted && failures.length === 0 && capBlockedCount > 0 && counters.success === 0
      ? 'notification_cap_blocked'
      : undefined,
    serverTime,
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    runId,
    templateKey,
    templateVersion: expectedTemplateVersion,
    executedCount: counters.success,
    capBlockedCount,
    capBlockedLineUserIds,
    capBlockedSummary,
    failures,
    runSummary: {
      status: aborted ? 'ABORTED' : (counters.failed > 0 ? 'DONE_WITH_ERRORS' : 'DONE'),
      counters,
      abortDetail: abortDetail || null
    }
  };
}

module.exports = {
  executeSegmentSend
};
