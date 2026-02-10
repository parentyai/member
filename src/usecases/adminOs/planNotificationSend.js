'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { createConfirmToken } = require('../../domain/confirmToken');
const { computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');

function buildTemplateKey(notificationId) {
  return `notification_send:${notificationId}`;
}

function requireNumber(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} required`);
  return value;
}

function toLineUserIds(users) {
  if (!Array.isArray(users)) return [];
  return users
    .map((u) => (u && typeof u.id === 'string' ? u.id : null))
    .filter((id) => typeof id === 'string')
    .sort();
}

async function planNotificationSend(params, deps) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');
  const actor = payload.actor || 'unknown';
  const traceId = payload.traceId || null;
  const requestId = payload.requestId || null;

  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) throw new Error('notification not found');
  if (notification.status !== 'active') throw new Error('notification not active');

  const target = notification.target && typeof notification.target === 'object' ? notification.target : {};
  const limit = requireNumber(target.limit, 'target.limit');

  const users = await usersRepo.listUsers({
    scenarioKey: notification.scenarioKey,
    stepKey: notification.stepKey,
    region: target.region,
    membersOnly: target.membersOnly,
    limit
  });
  const lineUserIds = toLineUserIds(users);
  if (!lineUserIds.length) throw new Error('no recipients');

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const serverTime = now.toISOString();
  const bucket = resolveDateBucket(now);
  const templateKey = buildTemplateKey(notificationId);
  const planHash = computePlanHash(templateKey, lineUserIds, bucket);
  const confirmToken = createConfirmToken({
    planHash,
    templateKey,
    templateVersion: '',
    segmentKey: notificationId
  }, { now });

  const audit = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  await audit({
    actor,
    action: 'notifications.send.plan',
    entityType: 'notification',
    entityId: notificationId,
    traceId,
    requestId,
    templateKey,
    payloadSummary: {
      notificationId,
      count: lineUserIds.length,
      planHash,
      bucket,
      limit
    },
    snapshot: {
      notificationId,
      status: notification.status || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      target: notification.target || null,
      count: lineUserIds.length,
      lineUserIdsSample: lineUserIds.slice(0, 10),
      planHash,
      bucket,
      serverTime
    }
  });

  return {
    ok: true,
    serverTime,
    traceId,
    requestId,
    notificationId,
    count: lineUserIds.length,
    planHash,
    confirmToken
  };
}

async function getLatestNotificationPlan(notificationId) {
  const templateKey = buildTemplateKey(notificationId);
  const latest = await auditLogsRepo.getLatestAuditLog({ action: 'notifications.send.plan', templateKey });
  return latest;
}

module.exports = {
  planNotificationSend,
  getLatestNotificationPlan,
  buildTemplateKey
};

