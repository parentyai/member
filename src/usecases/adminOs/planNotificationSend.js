'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { createConfirmToken } = require('../../domain/confirmToken');
const { computePlanHash, resolveDateBucket } = require('../phase67/segmentSendHash');
const { checkNotificationCap } = require('../notifications/checkNotificationCap');
const { resolveNotificationCtaAuditSummary } = require('../../domain/notificationCtaAudit');

const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

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
  const status = typeof notification.status === 'string' ? notification.status : 'draft';
  if (status !== 'active' && status !== 'planned') throw new Error('notification not active/planned');
  const ctaSummary = resolveNotificationCtaAuditSummary(notification, {
    allowSecondary: true,
    ignoreSecondary: false
  });

  const target = notification.target && typeof notification.target === 'object' ? notification.target : {};
  const limit = requireNumber(target.limit, 'target.limit');
  const region = typeof target.region === 'string' ? target.region.trim() : '';

  const users = await usersRepo.listUsers({
    [FIELD_SCK]: notification[FIELD_SCK],
    stepKey: notification.stepKey,
    region: region || undefined,
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
      stateFrom: status,
      stateTo: 'planned',
      checkedAt: serverTime,
      count: lineUserIds.length,
      planHash,
      bucket,
      limit,
      notificationCategory: notification.notificationCategory || null,
      ctaCount: ctaSummary.ctaCount,
      ctaLinkRegistryIds: ctaSummary.ctaLinkRegistryIds,
      ctaLabelHashes: ctaSummary.ctaLabelHashes,
      ctaLabelLengths: ctaSummary.ctaLabelLengths,
      capBlockedCount: capSummary.capBlockedCount,
      capCountMode: capSummary.capCountMode,
      capCountSource: capSummary.capCountSource,
      capCountStrategy: capSummary.capCountStrategy,
      capBlockedSummary: capSummary.capBlockedSummary
    },
    snapshot: {
      notificationId,
      statusBefore: status,
      statusAfter: 'planned',
      [FIELD_SCK]: notification[FIELD_SCK] || null,
      stepKey: notification.stepKey || null,
      notificationCategory: notification.notificationCategory || null,
      ctaCount: ctaSummary.ctaCount,
      ctaLinkRegistryIds: ctaSummary.ctaLinkRegistryIds,
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
  await notificationsRepo.updateNotificationStatus(notificationId, {
    status: 'planned',
    plannedAt: serverTime,
    plannedBy: actor,
    lastPlanHash: planHash,
    lastPlanCount: lineUserIds.length
  });

  return {
    ok: true,
    serverTime,
    traceId,
    requestId,
    notificationId,
    status: 'planned',
    count: lineUserIds.length,
    planHash,
    confirmToken,
    capBlockedCount: capSummary.capBlockedCount,
    capBlockedSummary: capSummary.capBlockedSummary,
    ctaCount: ctaSummary.ctaCount,
    ctaLinkRegistryIds: ctaSummary.ctaLinkRegistryIds,
    ctaLabelHashes: ctaSummary.ctaLabelHashes,
    ctaLabelLengths: ctaSummary.ctaLabelLengths,
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
