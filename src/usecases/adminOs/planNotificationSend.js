'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { createConfirmToken } = require('../../domain/confirmToken');
const { computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');

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

async function resolveCapBlockedSummary(lineUserIds, notification, now, deps) {
  let notificationCaps = null;
  let deliveryCountLegacyFallback = true;
  try {
    const getNotificationCaps = deps && deps.getNotificationCaps
      ? deps.getNotificationCaps
      : systemFlagsRepo.getNotificationCaps;
    notificationCaps = await getNotificationCaps();
  } catch (_err) {
    notificationCaps = null;
  }
  try {
    const getDeliveryCountLegacyFallback = deps && deps.getDeliveryCountLegacyFallback
      ? deps.getDeliveryCountLegacyFallback
      : systemFlagsRepo.getDeliveryCountLegacyFallback;
    deliveryCountLegacyFallback = await getDeliveryCountLegacyFallback();
  } catch (_err) {
    deliveryCountLegacyFallback = true;
  }

  let capCountMode = null;
  let capCountSource = null;
  let capCountStrategy = null;
  let capBlockedCount = 0;
  const capBlockedSummary = {};

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
        : undefined,
      getDeliveredCountsSnapshot: deps && deps.getDeliveredCountsSnapshot
        ? deps.getDeliveredCountsSnapshot
        : undefined
    });
    if (!capCountMode && capResult.countMode) capCountMode = capResult.countMode;
    if (!capCountSource && capResult.countSource) capCountSource = capResult.countSource;
    if (!capCountStrategy && capResult.countStrategy) capCountStrategy = capResult.countStrategy;
    if (!capResult.allowed) {
      capBlockedCount += 1;
      const key = `${capResult.capType || 'UNKNOWN'}:${capResult.reason || 'unknown'}`;
      capBlockedSummary[key] = (capBlockedSummary[key] || 0) + 1;
    }
  }

  return {
    capBlockedCount,
    capBlockedSummary,
    capCountMode,
    capCountSource,
    capCountStrategy
  };
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
  const capSummary = await resolveCapBlockedSummary(lineUserIds, notification, now, deps);

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
      limit,
      notificationCategory: notification.notificationCategory || null,
      capBlockedCount: capSummary.capBlockedCount,
      capCountMode: capSummary.capCountMode,
      capCountSource: capSummary.capCountSource,
      capCountStrategy: capSummary.capCountStrategy,
      capBlockedSummary: capSummary.capBlockedSummary
    },
    snapshot: {
      notificationId,
      status: notification.status || null,
      scenarioKey: notification.scenarioKey || null,
      stepKey: notification.stepKey || null,
      notificationCategory: notification.notificationCategory || null,
      target: notification.target || null,
      count: lineUserIds.length,
      lineUserIdsSample: lineUserIds.slice(0, 10),
      planHash,
      bucket,
      serverTime,
      capBlockedCount: capSummary.capBlockedCount,
      capBlockedSummary: capSummary.capBlockedSummary
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
    confirmToken,
    capBlockedCount: capSummary.capBlockedCount,
    capBlockedSummary: capSummary.capBlockedSummary,
    capCountMode: capSummary.capCountMode,
    capCountSource: capSummary.capCountSource,
    capCountStrategy: capSummary.capCountStrategy
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
