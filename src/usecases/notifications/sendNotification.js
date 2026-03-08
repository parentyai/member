'use strict';

const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const userCityPackPreferencesRepo = require('../../repos/firestore/userCityPackPreferencesRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
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
const {
  isCityPackModuleSubscriptionEnabled,
  isJourneyAttentionBudgetEnabled,
  getJourneyDailyAttentionBudgetMax,
  isUxOsFatigueWarnEnabled
} = require('../../domain/tasks/featureFlags');
const { isCityPackModuleSubscribed, normalizeModules } = require('../cityPack/filterCityPackModules');
const { computeAttentionBudget } = require('./computeAttentionBudget');
const { computeNotificationFatigueWarning } = require('./computeNotificationFatigueWarning');
const { buildLineNotificationMessage } = require('./buildLineNotificationMessage');
const { resolveLinkIntent } = require('../linkRegistry/resolveLinkIntent');
const { appendUxEvent } = require('../observability/appendUxEvent');
const { attachNotificationSendSummary } = require('../../domain/notificationSendSummary');
const { reportSuppressedError } = require('../../shared/suppressedErrorReporter');

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
    const resolved = await resolveLinkIntent({
      linkId: slot.linkRegistryId
    }, {
      linkRegistryRepo
    });
    if (!resolved || !resolved.ok || !resolved.link) throw new Error('link registry entry not found');
    const linkEntry = resolved.link;
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
  let effectiveUsers = overrideLineUserIds.length
    ? overrideLineUserIds.map((id) => ({ id }))
    : users;
  const cityPackModulesUpdated = normalizeModules(
    payload.cityPackModulesUpdated || effectiveNotification.cityPackModulesUpdated || []
  );
  let cityPackSubscriptionFilterApplied = false;
  let cityPackSubscriptionFilterSkipped = 0;
  if (isCityPackModuleSubscriptionEnabled() && cityPackModulesUpdated.length && overrideLineUserIds.length === 0) {
    const candidateIds = effectiveUsers.map((user) => user && user.id).filter(Boolean);
    const preferences = await userCityPackPreferencesRepo
      .listUserCityPackPreferencesByLineUserIds(candidateIds)
      .catch(() => []);
    const preferenceMap = new Map();
    preferences.forEach((row) => {
      if (!row || !row.lineUserId) return;
      preferenceMap.set(row.lineUserId, Array.isArray(row.modulesSubscribed) ? row.modulesSubscribed : []);
    });
    const filtered = effectiveUsers.filter((user) => {
      const subscribed = preferenceMap.get(user.id) || [];
      return isCityPackModuleSubscribed({
        modulesUpdated: cityPackModulesUpdated,
        modulesSubscribed: subscribed
      });
    });
    cityPackSubscriptionFilterApplied = true;
    cityPackSubscriptionFilterSkipped = Math.max(0, effectiveUsers.length - filtered.length);
    effectiveUsers = filtered;
  }

  if (!effectiveUsers.length) {
    throw new Error('no recipients');
  }
  const applyAttentionBudget = payload.applyAttentionBudget === true && isJourneyAttentionBudgetEnabled();
  const budgetRemainingByUser = new Map();
  if (applyAttentionBudget) {
    const profileRows = await userJourneyProfilesRepo
      .listUserJourneyProfilesByLineUserIds({ lineUserIds: effectiveUsers.map((user) => user.id) })
      .catch(() => []);
    const profileMap = new Map();
    profileRows.forEach((row) => {
      if (!row || !row.lineUserId) return;
      profileMap.set(row.lineUserId, row);
    });
    const maxPerDay = getJourneyDailyAttentionBudgetMax();
    for (const user of effectiveUsers) {
      const profile = profileMap.get(user.id) || null;
      // eslint-disable-next-line no-await-in-loop
      const budget = await computeAttentionBudget({
        lineUserId: user.id,
        timezone: profile && profile.timezone ? profile.timezone : 'UTC',
        now: payload.sentAt || new Date().toISOString(),
        maxPerDay
      }).catch(() => ({ remainingCount: maxPerDay }));
      budgetRemainingByUser.set(user.id, Math.max(0, Number(budget.remainingCount || 0)));
    }
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
  const reportSuppressedErrorFn = typeof payload.reportSuppressedErrorFn === 'function'
    ? payload.reportSuppressedErrorFn
    : reportSuppressedError;
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
  const appendUxEventFn = typeof payload.appendUxEventFn === 'function'
    ? payload.appendUxEventFn
    : appendUxEvent;
  const fatigueWarnEnabled = isUxOsFatigueWarnEnabled();
  const computeFatigueWarningFn = typeof payload.computeNotificationFatigueWarningFn === 'function'
    ? payload.computeNotificationFatigueWarningFn
    : computeNotificationFatigueWarning;
  const trackBaseUrl = resolveTrackBaseUrl();
  const trackEnabled = Boolean(trackBaseUrl && hasTrackTokenSecret());

  let deliveredCount = 0;
  let skippedCount = 0;
  let lineMessageType = 'text';
  let fatigueWarningCount = 0;
  const fatigueWarnings = [];
  let failedCount = 0;
  const failureSample = [];
  const continueOnError = payload.continueOnError === true;

  for (const user of effectiveUsers) {
    if (applyAttentionBudget) {
      const remaining = budgetRemainingByUser.has(user.id)
        ? Number(budgetRemainingByUser.get(user.id))
        : getJourneyDailyAttentionBudgetMax();
      if (!Number.isFinite(remaining) || remaining <= 0) {
        skippedCount += 1;
        continue;
      }
    }
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
          reportSuppressedErrorFn({
            scope: 'notifications.sendNotification',
            stage: 'build_track_url_failed',
            err: _err,
            traceId,
            requestId,
            actor: actor || 'send_notification',
            lineUserId: user.id,
            notificationId,
            deliveryId
          });
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
      if (applyAttentionBudget) {
        const remaining = budgetRemainingByUser.has(user.id)
          ? Number(budgetRemainingByUser.get(user.id))
          : getJourneyDailyAttentionBudgetMax();
        if (Number.isFinite(remaining) && remaining > 0) {
          budgetRemainingByUser.set(user.id, remaining - 1);
        }
      }
    } catch (err) {
      failedCount += 1;
      const message = err && err.message ? String(err.message) : 'send failed';
      if (failureSample.length < 20) {
        failureSample.push({
          lineUserId: user.id,
          deliveryId,
          stage: 'push_failed',
          error: message
        });
      }
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
          lastError: message,
          lastErrorAt: sentAt
        });
      } catch (_ignored) {
        reportSuppressedErrorFn({
          scope: 'notifications.sendNotification',
          stage: 'persist_failed_delivery_record_after_push_error',
          err: _ignored,
          traceId,
          requestId,
          actor: actor || 'send_notification',
          lineUserId: user.id,
          notificationId,
          deliveryId
        });
      }
      if (!continueOnError) throw err;
      continue;
    }

    try {
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
      failedCount += 1;
      const message = err && err.message ? String(err.message) : 'delivery persistence failed';
      if (failureSample.length < 20) {
        failureSample.push({
          lineUserId: user.id,
          deliveryId,
          stage: 'delivery_persist_failed_after_push',
          error: message
        });
      }
      // Keep delivery in a non-failed state to avoid duplicate resend after push succeeded.
      try {
        await deliveriesRepo.createDeliveryWithId(deliveryId, {
          notificationId,
          lineUserId: user.id,
          state: 'delivery_persist_failed_after_push',
          deliveryPersistError: message,
          deliveryPersistErrorAt: sentAt,
          sentAt
        });
      } catch (_ignored) {
        reportSuppressedErrorFn({
          scope: 'notifications.sendNotification',
          stage: 'persist_delivery_persist_failed_after_push_state',
          err: _ignored,
          traceId,
          requestId,
          actor: actor || 'send_notification',
          lineUserId: user.id,
          notificationId,
          deliveryId
        });
      }
      if (!continueOnError) throw err;
      continue;
    }

    try {
      await appendUxEventFn({
        eventType: 'notification_sent',
        deliveryId,
        notificationId,
        lineUserId: user.id,
        notificationCategory: effectiveNotification.notificationCategory || null,
        traceId,
        requestId,
        actor: actor || 'send_notification',
        sentAt
      });
    } catch (_err) {
      reportSuppressedErrorFn({
        scope: 'notifications.sendNotification',
        stage: 'append_ux_event_failed',
        err: _err,
        traceId,
        requestId,
        actor: actor || 'send_notification',
        lineUserId: user.id,
        notificationId,
        deliveryId
      });
    }
    if (fatigueWarnEnabled) {
      try {
        const warning = await computeFatigueWarningFn({
          lineUserId: user.id,
          sentAt,
          notificationCategory: effectiveNotification.notificationCategory || null
        }, {
          deliveriesRepo
        });
        if (warning && warning.warn === true) {
          fatigueWarningCount += 1;
          if (fatigueWarnings.length < 20) {
            fatigueWarnings.push({
              lineUserId: warning.lineUserId || user.id,
              notificationCategory: warning.notificationCategory || null,
              sinceAt: warning.sinceAt || null,
              deliveredToday: Number.isFinite(Number(warning.deliveredToday)) ? Number(warning.deliveredToday) : 0,
              projectedDeliveredToday: Number.isFinite(Number(warning.projectedDeliveredToday))
                ? Number(warning.projectedDeliveredToday)
                : 0,
              threshold: Number.isFinite(Number(warning.threshold)) ? Number(warning.threshold) : 0,
              reason: warning.reason || 'daily_notification_volume_high'
            });
          }
        }
      } catch (_err) {
        reportSuppressedErrorFn({
          scope: 'notifications.sendNotification',
          stage: 'fatigue_warning_compute_failed',
          err: _err,
          traceId,
          requestId,
          actor: actor || 'send_notification',
          lineUserId: user.id,
          notificationId,
          deliveryId
        });
      }
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
      reportSuppressedErrorFn({
        scope: 'notifications.sendNotification',
        stage: 'append_decision_timeline_failed',
        err,
        traceId,
        requestId,
        actor: actor || 'send_notification',
        lineUserId: user.id,
        notificationId,
        deliveryId
      });
    }
    try {
      await recordSent({
        notificationId,
        ctaText: ctaSlots[0] ? ctaSlots[0].ctaText : null,
        linkRegistryId: ctaSlots[0] ? ctaSlots[0].linkRegistryId : null,
        ctaSlots: ctaSlots.map((slot) => slot.slot)
      });
    } catch (err) {
      // CTA stats failure must not block delivery.
      reportSuppressedErrorFn({
        scope: 'notifications.sendNotification',
        stage: 'record_sent_stats_failed',
        err,
        traceId,
        requestId,
        actor: actor || 'send_notification',
        lineUserId: user.id,
        notificationId,
        deliveryId
      });
    }
  }

  const partialFailure = failedCount > 0;

  if (!skipStatusUpdate && !partialFailure) {
    await notificationsRepo.updateNotificationStatus(notificationId, {
      status: 'sent',
      sentAt: sentAt || null
    });
  }

  return attachNotificationSendSummary({
    ok: !partialFailure,
    status: partialFailure ? 'completed_with_failures' : 'completed',
    notificationId,
    deliveredCount,
    skippedCount,
    failedCount,
    partialFailure,
    failureSample,
    fallbackUsed: useFallback,
    optionalSourceFailureCount: optionalSourceFailures.length,
    ctaCount: ctaSlots.length,
    ctaLinkRegistryIds: ctaSlots.map((slot) => slot.linkRegistryId),
    lineMessageType,
    cityPackModulesUpdated,
    cityPackSubscriptionFilterApplied,
    cityPackSubscriptionFilterSkipped,
    attentionBudgetApplied: applyAttentionBudget,
    fatigueWarnEnabled,
    fatigueWarningCount,
    fatigueWarnings
  }, {
    totalRecipients: effectiveUsers.length
  });
}

module.exports = {
  sendNotification
};
