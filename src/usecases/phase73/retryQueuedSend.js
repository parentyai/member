'use strict';

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const notificationTemplatesRepo = require('../../repos/firestore/notificationTemplatesRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { testSendNotification } = require('../notifications/testSendNotification');
const { computeRetryPlanHash, confirmTokenData } = require('./planRetryQueuedSend');
const { evaluateNotificationPolicy, resolveNotificationCategoryFromTemplate } = require('../../domain/notificationPolicy');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');

function resolvePayloadSnapshot(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.payloadSnapshot && typeof item.payloadSnapshot === 'object') return item.payloadSnapshot;
  return null;
}

async function retryQueuedSend(params, deps) {
  const payload = params || {};
  const queueId = payload.queueId;
  if (!queueId) throw new Error('queueId required');

  const actor = payload.actor || payload.decidedBy || payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const payloadPlanHash = typeof payload.planHash === 'string' && payload.planHash.trim().length > 0 ? payload.planHash.trim() : null;
  const confirmToken = typeof payload.confirmToken === 'string' && payload.confirmToken.trim().length > 0 ? payload.confirmToken.trim() : null;

  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const sendFn = deps && deps.sendFn ? deps.sendFn : testSendNotification;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const templateRepo = deps && deps.notificationTemplatesRepo ? deps.notificationTemplatesRepo : notificationTemplatesRepo;

  const item = await repo.getQueueItem(queueId);
  if (!item) return { ok: false, reason: 'queue_not_found', status: 404 };
  if (item.status && item.status !== 'PENDING') {
    return { ok: false, reason: 'queue_not_pending', status: 409, queueStatus: item.status };
  }

  const snapshot = resolvePayloadSnapshot(item);
  if (!snapshot || !snapshot.lineUserId) {
    return { ok: false, reason: 'payload_missing', status: 500 };
  }

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    try {
      await appendAuditLog({
        actor,
        action: 'retry_queue.execute',
        entityType: 'send_retry_queue',
        entityId: queueId,
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        payloadSummary: { ok: false, reason: 'kill_switch_on', queueId }
      });
    } catch (_err) {
      // best-effort only
    }
    return { ok: false, reason: 'kill_switch_on' };
  }

  let notificationCategory = null;
  if (typeof snapshot.notificationCategory === 'string' && snapshot.notificationCategory.trim().length > 0) {
    notificationCategory = snapshot.notificationCategory.trim();
  } else if (typeof item.templateKey === 'string' && item.templateKey.trim().length > 0) {
    try {
      const template = await templateRepo.getTemplateByKey(item.templateKey.trim());
      notificationCategory = resolveNotificationCategoryFromTemplate(template);
    } catch (_err) {
      notificationCategory = null;
    }
  }
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
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: false,
        reason: 'notification_policy_blocked',
        policyReason: policyResult.reason,
        servicePhase: policyResult.servicePhase,
        notificationPreset: policyResult.notificationPreset,
        notificationCategory: policyResult.notificationCategory,
        queueId
      }
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

  const expectedPlanHash = computeRetryPlanHash(queueId, item);
  if (!payloadPlanHash || !confirmToken) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'confirm_token_required', queueId }
    });
    return { ok: false, reason: 'confirm_token_required', status: 400 };
  }
  if (payloadPlanHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', queueId, expectedPlanHash }
    });
    return { ok: false, reason: 'plan_hash_mismatch', status: 409, expectedPlanHash };
  }
  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(expectedPlanHash, queueId), {
    secret: deps && deps.confirmTokenSecret,
    now
  });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', queueId }
    });
    return { ok: false, reason: 'confirm_token_mismatch', status: 409 };
  }

  const capResult = await checkNotificationCap({
    lineUserId: snapshot.lineUserId,
    now,
    notificationCaps,
    notificationCategory
  }, {
    countDeliveredByUserSince: deps && deps.countDeliveredByUserSince
      ? deps.countDeliveredByUserSince
      : undefined,
    countDeliveredByUserCategorySince: deps && deps.countDeliveredByUserCategorySince
      ? deps.countDeliveredByUserCategorySince
      : undefined
  });
  if (!capResult.allowed) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: false,
        reason: 'notification_cap_blocked',
        queueId,
        lineUserId: snapshot.lineUserId,
        capType: capResult.capType || null,
        capReason: capResult.reason || null,
        perUserWeeklyCap: capResult.perUserWeeklyCap,
        perUserDailyCap: capResult.perUserDailyCap,
        perCategoryWeeklyCap: capResult.perCategoryWeeklyCap,
        deliveredCountWeekly: capResult.deliveredCountWeekly,
        deliveredCountDaily: capResult.deliveredCountDaily,
        deliveredCountCategoryWeekly: capResult.deliveredCountCategoryWeekly,
        dailyWindowStart: capResult.dailyWindowStart || null,
        weeklyWindowStart: capResult.weeklyWindowStart || null
      }
    });
    return {
      ok: false,
      reason: 'notification_cap_blocked',
      status: 409,
      queueId,
      lineUserId: snapshot.lineUserId,
      capType: capResult.capType || null,
      capReason: capResult.reason || null,
      perUserWeeklyCap: capResult.perUserWeeklyCap,
      perUserDailyCap: capResult.perUserDailyCap,
      perCategoryWeeklyCap: capResult.perCategoryWeeklyCap,
      deliveredCountWeekly: capResult.deliveredCountWeekly,
      deliveredCountDaily: capResult.deliveredCountDaily,
      deliveredCountCategoryWeekly: capResult.deliveredCountCategoryWeekly,
      dailyWindowStart: capResult.dailyWindowStart || null,
      weeklyWindowStart: capResult.weeklyWindowStart || null
    };
  }

  try {
      await sendFn({
        lineUserId: snapshot.lineUserId,
        text: snapshot.text || '',
        notificationId: snapshot.notificationId || item.templateKey || 'retry',
        notificationCategory: notificationCategory || null,
        deliveryId: snapshot.deliveryId || null,
        killSwitch
      }, deps);
    await repo.markDone(queueId);
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: true,
        queueId,
        templateKey: item.templateKey || null,
        lineUserId: snapshot.lineUserId || null,
        notificationId: snapshot.notificationId || null,
        deliveryId: snapshot.deliveryId || null,
        notificationCategory: notificationCategory || null
      }
    });
    return { ok: true, queueId };
  } catch (err) {
    const message = err && err.message ? err.message : 'send_failed';
    await repo.markFailed(queueId, message);
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: false,
        reason: 'send_failed',
        queueId,
        error: message,
        templateKey: item.templateKey || null,
        lineUserId: snapshot.lineUserId || null,
        notificationId: snapshot.notificationId || null,
        deliveryId: snapshot.deliveryId || null,
        notificationCategory: notificationCategory || null
      }
    });
    return { ok: false, reason: 'send_failed', error: message };
  }
}

module.exports = {
  retryQueuedSend
};
