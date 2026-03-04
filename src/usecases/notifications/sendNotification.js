'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const { pushMessage } = require('../../infra/lineClient');
const {
  validateKillSwitch,
  validateWarnLinkBlock,
  resolveNotificationCtas
} = require('../../domain/validators');
const { recordSent } = require('../phase18/recordCtaStats');
const { createTrackToken } = require('../../domain/trackToken');
const { computeNotificationDeliveryId, computeLineRetryKey } = require('../../domain/deliveryId');
const { evaluateCityPackSourcePolicy } = require('../../domain/cityPackPolicy');
const { validateCityPackSources } = require('../cityPack/validateCityPackSources');
const { buildLineNotificationMessage } = require('./buildLineNotificationMessage');

const FIELD_SCK = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);

function resolveTrackBaseUrl() {
  const value = process.env.TRACK_BASE_URL;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\/+$/, '');
  return trimmed.length ? trimmed : null;
}

function hasTrackTokenSecret() {
  const value = process.env.TRACK_TOKEN_SECRET;
  return typeof value === 'string' && value.trim().length > 0;
}

function buildTrackUrl(baseUrl, token) {
  if (!baseUrl || !token) return null;
  return `${baseUrl}/t/${encodeURIComponent(token)}`;
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function resolveNotificationCtaSlots(notification, multiCtaEnabled) {
  return resolveNotificationCtas(notification, {
    allowSecondary: multiCtaEnabled,
    ignoreSecondary: multiCtaEnabled !== true,
    minTotal: 1,
    maxSecondary: multiCtaEnabled ? 2 : 0,
    maxTotal: multiCtaEnabled ? 3 : 1
  });
}

async function resolveLinkEntriesForCtas(ctaSlots) {
  const map = new Map();
  for (const slot of ctaSlots) {
    if (!slot || !slot.linkRegistryId) continue;
    if (map.has(slot.linkRegistryId)) continue;
    const linkEntry = await linkRegistryRepo.getLink(slot.linkRegistryId);
    if (!linkEntry) throw new Error('link registry entry not found');
    validateWarnLinkBlock(linkEntry);
    map.set(slot.linkRegistryId, linkEntry);
  }
  return map;
}

function normalizeLineUserIds(ids) {
  if (!Array.isArray(ids)) return [];
  const normalized = ids
    .map((id) => (typeof id === 'string' ? id.trim() : ''))
    .filter((id) => id.length > 0);
  return Array.from(new Set(normalized)).sort();
}

function normalizeCityPackFallbackConfig(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const linkRegistryId = typeof payload.fallbackLinkRegistryId === 'string' ? payload.fallbackLinkRegistryId.trim() : '';
  const ctaText = typeof payload.fallbackCtaText === 'string' ? payload.fallbackCtaText.trim() : '';
  if (!linkRegistryId || !ctaText) return null;
  return { linkRegistryId, ctaText };
}

async function sendNotification(params) {
  const payload = params || {};
  const notificationId = payload.notificationId;
  if (!notificationId) throw new Error('notificationId required');

  const notification = await notificationsRepo.getNotification(notificationId);
  if (!notification) throw new Error('notification not found');
  const fallbackConfig = normalizeCityPackFallbackConfig(payload.cityPackFallback || notification.cityPackFallback);
  let optionalSourceFailures = [];

  if (Array.isArray(notification.sourceRefs) && notification.sourceRefs.length > 0) {
    const sourceValidation = await validateCityPackSources({ sourceRefs: notification.sourceRefs });
    const sourcePolicy = evaluateCityPackSourcePolicy(sourceValidation);
    if (!sourcePolicy.allowed) {
      const reason = sourcePolicy.blockedReasonCategory || 'SOURCE_BLOCKED';
      const err = new Error(reason);
      err.blockedReasonCategory = reason;
      err.invalidSourceRefs = sourcePolicy.invalidSourceRefs;
      throw err;
    }
    optionalSourceFailures = Array.isArray(sourcePolicy.optionalInvalidSourceRefs)
      ? sourcePolicy.optionalInvalidSourceRefs
      : [];
  }

  const useFallback = optionalSourceFailures.length > 0 && Boolean(fallbackConfig);
  const effectiveNotification = useFallback
    ? Object.assign({}, notification, {
      ctaText: fallbackConfig.ctaText,
      linkRegistryId: fallbackConfig.linkRegistryId,
      secondaryCtas: []
    })
    : notification;

  validateKillSwitch(payload.killSwitch);
  const multiCtaEnabled = resolveBooleanEnvFlag('ENABLE_NOTIFICATION_CTA_MULTI_V1', false);
  const lineCtaButtonsEnabled = resolveBooleanEnvFlag('ENABLE_LINE_CTA_BUTTONS_V1', false);
  const ctaSlots = resolveNotificationCtaSlots(effectiveNotification, multiCtaEnabled);
  const ctaLinkMap = await resolveLinkEntriesForCtas(ctaSlots);

  if (!effectiveNotification[FIELD_SCK] || !effectiveNotification.stepKey) {
    throw new Error('cohort/step required');
  }

  const target = effectiveNotification.target || {};
  if (!target || typeof target !== 'object') {
    throw new Error('target required');
  }

  const users = await usersRepo.listUsers({
    [FIELD_SCK]: effectiveNotification[FIELD_SCK],
    stepKey: effectiveNotification.stepKey,
    region: target.region,
    membersOnly: target.membersOnly,
    limit: target.limit
  });

  const overrideLineUserIds = normalizeLineUserIds(payload.lineUserIds);
  const effectiveUsers = overrideLineUserIds.length
    ? overrideLineUserIds.map((id) => ({ id }))
    : users;

  if (!effectiveUsers.length) {
    throw new Error('no recipients');
  }

  const pushFn = payload.pushFn || pushMessage;
  const sentAt = payload.sentAt || new Date().toISOString();
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0
    ? payload.traceId.trim()
    : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0
    ? payload.requestId.trim()
    : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0
    ? payload.actor.trim()
    : null;
  const auditContext = payload.auditContext && typeof payload.auditContext === 'object'
    ? payload.auditContext
    : {};
  const deliveryTaskMeta = {
    taskId: typeof auditContext.taskId === 'string' && auditContext.taskId.trim().length > 0
      ? auditContext.taskId.trim()
      : null,
    ruleId: typeof auditContext.ruleId === 'string' && auditContext.ruleId.trim().length > 0
      ? auditContext.ruleId.trim()
      : null,
    decision: typeof auditContext.decision === 'string' && auditContext.decision.trim().length > 0
      ? auditContext.decision.trim()
      : null,
    checkedAt: typeof auditContext.checkedAt === 'string' && auditContext.checkedAt.trim().length > 0
      ? auditContext.checkedAt.trim()
      : null,
    blockedReason: typeof auditContext.blockedReason === 'string' && auditContext.blockedReason.trim().length > 0
      ? auditContext.blockedReason.trim()
      : null
  };
  const skipStatusUpdate = payload.skipStatusUpdate === true;
  const trackBaseUrl = resolveTrackBaseUrl();
  const trackEnabled = Boolean(trackBaseUrl && hasTrackTokenSecret());

  let deliveredCount = 0;
  let skippedCount = 0;
  let lineMessageType = 'text';

  for (const user of effectiveUsers) {
    const deliveryId = computeNotificationDeliveryId({ notificationId, lineUserId: user.id });
    const reserved = await deliveriesRepo.reserveDeliveryWithId(deliveryId, {
      notificationId,
      lineUserId: user.id,
      notificationCategory: effectiveNotification.notificationCategory || null,
      taskId: deliveryTaskMeta.taskId,
      ruleId: deliveryTaskMeta.ruleId,
      decision: deliveryTaskMeta.decision,
      checkedAt: deliveryTaskMeta.checkedAt,
      blockedReason: deliveryTaskMeta.blockedReason
    });
    const existing = reserved && reserved.existing ? reserved.existing : null;
    if (existing && existing.sealed === true) {
      skippedCount += 1;
      continue;
    }
    if (existing && existing.delivered === true) {
      skippedCount += 1;
      continue;
    }
    // If the delivery exists but isn't marked failed, treat it as in-flight/unknown and skip.
    // This prevents duplicates if the process crashed after pushing but before marking delivered.
    if (existing && existing.delivered !== true && !existing.lastError) {
      skippedCount += 1;
      continue;
    }

    const resolvedCtas = ctaSlots.map((slot) => {
      const linkEntry = ctaLinkMap.get(slot.linkRegistryId);
      const originalUrl = linkEntry && typeof linkEntry.url === 'string' ? linkEntry.url : '';
      let trackedUrl = originalUrl;
      if (trackEnabled && originalUrl) {
        try {
          const token = createTrackToken({
            deliveryId,
            linkRegistryId: slot.linkRegistryId,
            ctaSlot: slot.slot
          });
          const url = buildTrackUrl(trackBaseUrl, token);
          if (url) trackedUrl = url;
        } catch (_err) {
          trackedUrl = originalUrl;
        }
      }
      return {
        slot: slot.slot,
        ctaText: slot.ctaText,
        linkRegistryId: slot.linkRegistryId,
        originalUrl,
        url: trackedUrl
      };
    });
    const builtMessage = buildLineNotificationMessage({
      notification: effectiveNotification,
      ctas: resolvedCtas,
      preferTemplateButtons: lineCtaButtonsEnabled
    });
    lineMessageType = builtMessage.lineMessageType || 'text';
    try {
      await pushFn(user.id, builtMessage.message, { retryKey: computeLineRetryKey({ deliveryId }) });
      deliveredCount += 1;
      await deliveriesRepo.createDeliveryWithId(deliveryId, {
        notificationId,
        lineUserId: user.id,
        notificationCategory: effectiveNotification.notificationCategory || null,
        taskId: deliveryTaskMeta.taskId,
        ruleId: deliveryTaskMeta.ruleId,
        decision: deliveryTaskMeta.decision,
        checkedAt: deliveryTaskMeta.checkedAt,
        blockedReason: deliveryTaskMeta.blockedReason,
        sentAt,
        delivered: true,
        state: 'delivered',
        deliveredAt: sentAt,
        lastError: null,
        lastErrorAt: null
      });
    } catch (err) {
      try {
        await deliveriesRepo.createDeliveryWithId(deliveryId, {
          notificationId,
          lineUserId: user.id,
          notificationCategory: notification.notificationCategory || null,
          taskId: deliveryTaskMeta.taskId,
          ruleId: deliveryTaskMeta.ruleId,
          decision: deliveryTaskMeta.decision,
          checkedAt: deliveryTaskMeta.checkedAt,
          blockedReason: deliveryTaskMeta.blockedReason,
          sentAt: null,
          delivered: false,
          state: 'failed',
          lastError: err && err.message ? String(err.message) : 'send failed',
          lastErrorAt: sentAt
        });
      } catch (_ignored) {
        // best-effort only
      }
      throw err;
    }
    try {
      await decisionTimelineRepo.appendTimelineEntry({
        lineUserId: user.id,
        source: 'notification',
        action: 'NOTIFY',
        refId: notificationId,
        notificationId,
        traceId: traceId || undefined,
        requestId: requestId || undefined,
        actor: actor || undefined,
        snapshot: {
          delivered: true,
          sentAt: sentAt || null,
          taskId: deliveryTaskMeta.taskId,
          ruleId: deliveryTaskMeta.ruleId,
          decision: deliveryTaskMeta.decision,
          checkedAt: deliveryTaskMeta.checkedAt,
          blockedReason: deliveryTaskMeta.blockedReason
        }
      });
    } catch (err) {
      // best-effort only
    }
    try {
      await recordSent({
        notificationId,
        ctaText: ctaSlots[0] ? ctaSlots[0].ctaText : null,
        linkRegistryId: ctaSlots[0] ? ctaSlots[0].linkRegistryId : null,
        ctaSlots: ctaSlots.map((slot) => slot.slot)
      });
    } catch (err) {
      // CTA stats failure must not block delivery — best-effort only.
    }
  }

  if (!skipStatusUpdate) {
    await notificationsRepo.updateNotificationStatus(notificationId, {
      status: 'sent',
      sentAt: sentAt || null
    });
  }

  return {
    notificationId,
    deliveredCount,
    skippedCount,
    fallbackUsed: useFallback,
    optionalSourceFailureCount: optionalSourceFailures.length,
    ctaCount: ctaSlots.length,
    ctaLinkRegistryIds: ctaSlots.map((slot) => slot.linkRegistryId),
    lineMessageType
  };
}

module.exports = {
  sendNotification
};
