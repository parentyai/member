'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
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

  async function appendExecuteAudit(summary) {
    await audit({
      actor,
      action: 'notifications.send.execute',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      templateKey: buildTemplateKey(notificationId),
      payloadSummary: Object.assign({ ok: false }, summary || {})
    });
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
  const perUserWeeklyCap = notificationCaps.perUserWeeklyCap;
  for (const lineUserId of lineUserIds) {
    const capResult = await checkNotificationCap({
      lineUserId,
      now,
      notificationCaps,
      notificationCategory: notification.notificationCategory || null
    }, {
      countDeliveredByUserSince: deps && deps.countDeliveredByUserSince
        ? deps.countDeliveredByUserSince
        : undefined,
      countDeliveredByUserCategorySince: deps && deps.countDeliveredByUserCategorySince
        ? deps.countDeliveredByUserCategorySince
        : undefined
    });
    if (!capResult.allowed) {
      if (capBlockedLineUserIds.length < 50) capBlockedLineUserIds.push(lineUserId);
      const key = `${capResult.capType || 'UNKNOWN'}:${capResult.reason || 'unknown'}`;
      capBlockedSummary[key] = (capBlockedSummary[key] || 0) + 1;
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
      capBlockedSummary
    });
    return {
      ok: false,
      reason: 'notification_cap_blocked',
      capBlockedCount,
      capBlockedLineUserIds,
      capBlockedSummary,
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
      pushFn
    });
  } catch (err) {
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
      notificationCategory: notification.notificationCategory || null
    }
  });

  return Object.assign({ ok: true, traceId, requestId, capBlockedCount, capBlockedSummary }, result);
}

module.exports = {
  executeNotificationSend
};
