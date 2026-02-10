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
    return { ok: false, reason: 'plan_missing', traceId };
  }
  if (planHash !== expectedPlanHash) {
    return { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId };
  }

  const target = notification.target && typeof notification.target === 'object' ? notification.target : {};
  const limit = typeof target.limit === 'number' ? target.limit : null;
  if (!limit) {
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
    return { ok: false, reason: 'no_recipients', traceId };
  }

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const bucket = resolveDateBucket(now);
  const computed = computePlanHash(templateKey, lineUserIds, bucket);
  if (computed !== expectedPlanHash) {
    return { ok: false, reason: 'plan_mismatch', expectedPlanHash, traceId };
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, templateKey, notificationId), { now });
  if (!confirmOk) {
    const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
    await audit({
      actor,
      action: 'notifications.send.execute',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      templateKey,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch' }
    });
    return { ok: false, reason: 'confirm_token_mismatch', traceId };
  }

  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;
  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
    await audit({
      actor,
      action: 'notifications.send.execute',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      templateKey,
      payloadSummary: { ok: false, blockedByKillSwitch: true }
    });
    return { ok: false, blocked: true, killSwitch: true, reason: 'kill_switch_on', traceId };
  }

  const pushFn = deps && deps.pushFn ? deps.pushFn : undefined;
  const result = await sendNotification({
    notificationId,
    sentAt: now.toISOString(),
    killSwitch,
    lineUserIds,
    pushFn
  });

  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  await audit({
    actor,
    action: 'notifications.send.execute',
    entityType: 'notification',
    entityId: notificationId,
    traceId,
    requestId,
    templateKey,
    payloadSummary: { ok: true, deliveredCount: result.deliveredCount }
  });

  return Object.assign({ ok: true, traceId, requestId }, result);
}

module.exports = {
  executeNotificationSend
};

