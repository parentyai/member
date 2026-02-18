'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { verifyConfirmToken } = require('../../domain/confirmToken');
const { computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');
const { sendNotification } = require('../notifications/sendNotification');
const { buildTemplateKey } = require('./planNotificationSend');
const { evaluateNotificationPolicy } = require('../../domain/notificationPolicy');
const { normalizeNotificationCaps } = require('../../domain/notificationCaps');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');

function resolvePlanHash(auditLog) {
  if (!auditLog || typeof auditLog !== 'object') return null;
  const summary = auditLog.payloadSummary && typeof auditLog.payloadSummary === 'object' ? auditLog.payloadSummary : null;
  const fromSummary = summary && typeof summary.planHash === 'string' ? summary.planHash : null;
  if (fromSummary) return fromSummary;
  const snapshot = auditLog.snapshot && typeof auditLog.snapshot === 'object' ? auditLog.snapshot : null;
  const fromSnapshot = snapshot && typeof snapshot.planHash === 'string' ? snapshot.planHash : null;
  return fromSnapshot || null;
}

function toLineUserIds(users) {
  if (!Array.isArray(users)) return [];
  return users
    .map((u) => (u && typeof u.id === 'string' ? u.id : null))
    .filter((id) => typeof id === 'string')
    .sort();
}

function confirmTokenData(planHash, templateKey, notificationId) {
  return {
    planHash,
    templateKey,
    templateVersion: '',
    segmentKey: notificationId
  };
}

async function executeNotificationSend(params, deps) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');
  const actor = payload.actor || 'unknown';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;

  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  const decisionsRepo = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const timelineRepo = deps && deps.decisionTimelineRepo ? deps.decisionTimelineRepo : decisionTimelineRepo;

  function resolveDecision(reason) {
    if (!reason) return 'EXECUTE';
    if (reason === 'notification_cap_blocked') return 'BLOCK';
    if (reason === 'notification_policy_blocked') return 'BLOCK';
    if (reason === 'kill_switch_on') return 'BLOCK';
    return 'FAIL';
  }

  async function appendExecuteAudit(summary) {
    const payloadSummary = Object.assign({ ok: false }, summary || {});
    await audit({
      actor,
      action: 'notifications.send.execute',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      templateKey: buildTemplateKey(notificationId),
      payloadSummary
    });
    if (!decisionsRepo || typeof decisionsRepo.appendDecision !== 'function') return;
    try {
      await decisionsRepo.appendDecision({
        subjectType: 'notification_send',
        subjectId: notificationId,
        decision: resolveDecision(payloadSummary.reason),
        decidedBy: actor,
        reason: payloadSummary.reason || 'execute_failed',
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        audit: Object.assign({ notificationId }, payloadSummary)
      });
    } catch (_err) {
      // best-effort only
    }
  }

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) throw new Error('planHash/confirmToken required');

  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) throw new Error('notification not found');
  if (notification.status !== 'active') throw new Error('notification not active');

  const templateKey = buildTemplateKey(notificationId);
  const latestPlan = await auditLogsRepo.getLatestAuditLog({ action: 'notifications.send.plan', templateKey });
  const expectedPlanHash = resolvePlanHash(latestPlan);
  if (!expectedPlanHash) {
    await appendExecuteAudit({ reason: 'plan_missing' });
    return { ok: false, reason: 'plan_missing', traceId };
  }
  if (planHash !== expectedPlanHash) {
    await appendExecuteAudit({ reason: 'plan_hash_mismatch' });
    return { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId };
  }

  const target = notification.target && typeof notification.target === 'object' ? notification.target : {};
  const limit = typeof target.limit === 'number' ? target.limit : null;
  if (!limit) {
    await appendExecuteAudit({ reason: 'target_limit_required' });
    return { ok: false, reason: 'target_limit_required', traceId };
  }

  const users = await usersRepo.listUsers({
    scenarioKey: notification.scenarioKey,
    stepKey: notification.stepKey,
    region: target.region,
    membersOnly: target.membersOnly,
    limit
  });
  const lineUserIds = toLineUserIds(users);
  if (!lineUserIds.length) {
    await appendExecuteAudit({ reason: 'no_recipients' });
    return { ok: false, reason: 'no_recipients', traceId };
  }

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const bucket = resolveDateBucket(now);
  const computed = computePlanHash(templateKey, lineUserIds, bucket);
  if (computed !== expectedPlanHash) {
    await appendExecuteAudit({ reason: 'plan_mismatch' });
    return { ok: false, reason: 'plan_mismatch', expectedPlanHash, traceId };
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, templateKey, notificationId), { now });
  if (!confirmOk) {
    await appendExecuteAudit({ reason: 'confirm_token_mismatch' });
    return { ok: false, reason: 'confirm_token_mismatch', traceId };
  }

  let servicePhase = null;
  let notificationPreset = null;
  let notificationCaps = normalizeNotificationCaps(null);
  let deliveryCountLegacyFallback = true;
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
  try {
    const getDeliveryCountLegacyFallback = deps && deps.getDeliveryCountLegacyFallback
      ? deps.getDeliveryCountLegacyFallback
      : systemFlagsRepo.getDeliveryCountLegacyFallback;
    deliveryCountLegacyFallback = await getDeliveryCountLegacyFallback();
  } catch (_err) {
    deliveryCountLegacyFallback = true;
  }
  const policyResult = evaluateNotificationPolicy({
    servicePhase,
    notificationPreset,
    notificationCategory: notification.notificationCategory
  });
  if (!policyResult.allowed) {
    await appendExecuteAudit({
      reason: 'notification_policy_blocked',
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
      notificationCategory: policyResult.notificationCategory,
      traceId
    };
  }

  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    await appendExecuteAudit({ reason: 'kill_switch_on', blockedByKillSwitch: true });
    return { ok: false, blocked: true, killSwitch: true, reason: 'kill_switch_on', traceId };
  }

  const capEligibleLineUserIds = [];
  const capBlockedLineUserIds = [];
  const capBlockedSummary = {};
  let capCountMode = null;
  let capCountSource = null;
  let capCountStrategy = null;
  const perUserWeeklyCap = notificationCaps.perUserWeeklyCap;
  for (const lineUserId of lineUserIds) {
    const capResult = await checkNotificationCap({
      lineUserId,
      now,
      notificationCaps,
      deliveryCountLegacyFallback,
      notificationCategory: notification.notificationCategory || null
    }, {
      countDeliveredByUserSince: deps && deps.countDeliveredByUserSince
        ? deps.countDeliveredByUserSince
        : undefined,
      countDeliveredByUserCategorySince: deps && deps.countDeliveredByUserCategorySince
        ? deps.countDeliveredByUserCategorySince
        : undefined
    });
    if (!capCountMode && capResult.countMode) capCountMode = capResult.countMode;
    if (!capCountSource && capResult.countSource) capCountSource = capResult.countSource;
    if (!capCountStrategy && capResult.countStrategy) capCountStrategy = capResult.countStrategy;
    if (!capResult.allowed) {
      if (capBlockedLineUserIds.length < 50) capBlockedLineUserIds.push(lineUserId);
      const key = `${capResult.capType || 'UNKNOWN'}:${capResult.reason || 'unknown'}`;
      capBlockedSummary[key] = (capBlockedSummary[key] || 0) + 1;
      if (traceId && timelineRepo && typeof timelineRepo.appendTimelineEntry === 'function') {
        try {
          await timelineRepo.appendTimelineEntry({
            lineUserId,
            source: 'notification_send',
            action: 'BLOCKED',
            refId: notificationId,
            notificationId,
            traceId,
            requestId: requestId || undefined,
            actor,
            snapshot: {
              reason: 'notification_cap_blocked',
              capType: capResult.capType || null,
              capReason: capResult.reason || null
            }
          });
        } catch (_err) {
          // best-effort only
        }
      }
      continue;
    }
    capEligibleLineUserIds.push(lineUserId);
  }
  const capBlockedCount = lineUserIds.length - capEligibleLineUserIds.length;
  if (!capEligibleLineUserIds.length) {
    await appendExecuteAudit({
      reason: 'notification_cap_blocked',
      capBlockedCount,
      perUserWeeklyCap,
      capBlockedSummary,
      capCountMode,
      capCountSource,
      capCountStrategy
    });
    return {
      ok: false,
      reason: 'notification_cap_blocked',
      capBlockedCount,
      capBlockedLineUserIds,
      capBlockedSummary,
      capCountMode,
      capCountSource,
      capCountStrategy,
      perUserWeeklyCap,
      traceId
    };
  }

  const pushFn = deps && deps.pushFn ? deps.pushFn : undefined;
  let result = null;
  try {
    result = await sendNotification({
      notificationId,
      sentAt: now.toISOString(),
      killSwitch,
      lineUserIds: capEligibleLineUserIds,
      pushFn,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      actor
    });
  } catch (err) {
    const blockedReasonCategory = err && typeof err.blockedReasonCategory === 'string'
      ? err.blockedReasonCategory
      : (err && typeof err.message === 'string' && /^SOURCE_(EXPIRED|DEAD|BLOCKED)$/.test(err.message)
        ? err.message
        : null);
    if (blockedReasonCategory) {
      await appendExecuteAudit({
        reason: 'notification_source_blocked',
        blockedReasonCategory,
        invalidSourceRefs: err && Array.isArray(err.invalidSourceRefs) ? err.invalidSourceRefs : []
      });
      return {
        ok: false,
        reason: 'notification_source_blocked',
        blockedReasonCategory,
        invalidSourceRefs: err && Array.isArray(err.invalidSourceRefs) ? err.invalidSourceRefs : [],
        traceId
      };
    }
    await appendExecuteAudit({ reason: 'send_failed', errorClass: err && err.name ? String(err.name) : 'Error' });
    throw err;
  }

    await audit({
      actor,
      action: 'notifications.send.execute',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      templateKey,
      payloadSummary: {
        ok: true,
        deliveredCount: result.deliveredCount,
        skippedCount: result.skippedCount || 0,
        capBlockedCount,
        capBlockedSummary,
        capCountMode,
        capCountSource,
        capCountStrategy,
        notificationCategory: notification.notificationCategory || null
      }
    });
    if (decisionsRepo && typeof decisionsRepo.appendDecision === 'function') {
      try {
        await decisionsRepo.appendDecision({
          subjectType: 'notification_send',
          subjectId: notificationId,
          decision: 'EXECUTE',
          decidedBy: actor,
          reason: 'ok',
          traceId: traceId || undefined,
          requestId: requestId || undefined,
          audit: {
            notificationId,
            deliveredCount: result.deliveredCount,
            skippedCount: result.skippedCount || 0,
            capBlockedCount,
            capBlockedSummary,
            capCountMode,
            capCountSource,
            capCountStrategy,
            notificationCategory: notification.notificationCategory || null
          }
        });
      } catch (_err) {
        // best-effort only
      }
    }

  return Object.assign({
    ok: true,
    traceId,
    requestId,
    capBlockedCount,
    capBlockedSummary,
    capCountMode,
    capCountSource,
    capCountStrategy
  }, result);
}

module.exports = {
  executeNotificationSend
};
