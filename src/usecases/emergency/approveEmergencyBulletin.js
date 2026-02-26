'use strict';

const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const { createNotification } = require('../notifications/createNotification');
const { sendNotification } = require('../notifications/sendNotification');
const { mapFailureCode, FAILURE_CODES } = require('../../domain/notificationFailureTaxonomy');
const { appendEmergencyAudit } = require('./audit');
const { FANOUT_SCENARIOS, FANOUT_STEPS } = require('./constants');
const { buildEmergencyMessageDraft } = require('./messageTemplates');
const { normalizeString } = require('./utils');

const DEFAULT_CTA_TEXT = '公式情報を確認';

function resolveNow(params, deps) {
  if (params && params.now instanceof Date) return params.now;
  if (deps && deps.now instanceof Date) return deps.now;
  return new Date();
}

function resolveTraceId(params, now) {
  const explicit = normalizeString(params && params.traceId);
  if (explicit) return explicit;
  return `trace_emergency_approve_${now.getTime()}`;
}

function resolveActor(params) {
  return normalizeString(params && params.actor) || 'admin_emergency';
}

function resolveMessageDraft(bulletin) {
  const raw = normalizeString(bulletin && bulletin.messageDraft);
  if (raw) return raw;
  return buildEmergencyMessageDraft({
    severity: bulletin && bulletin.severity,
    category: bulletin && bulletin.category,
    regionKey: bulletin && bulletin.regionKey,
    headline: bulletin && bulletin.headline
  });
}

function resolveTitle(bulletin) {
  const headline = normalizeString(bulletin && bulletin.headline);
  if (headline) return headline.slice(0, 120);
  const category = normalizeString(bulletin && bulletin.category) || 'alert';
  const severity = normalizeString(bulletin && bulletin.severity) || 'WARN';
  return `Emergency ${category} (${severity})`;
}

function resolveCtaText(input) {
  const ctaText = normalizeString(input);
  if (ctaText) return ctaText;
  return DEFAULT_CTA_TEXT;
}

function normalizeSeverity(value) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'CRITICAL' || raw === 'WARN' || raw === 'INFO') return raw;
  return 'WARN';
}

function normalizeCategory(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return raw || 'alert';
}

function normalizeStatus(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (raw === 'draft' || raw === 'approved' || raw === 'sent' || raw === 'rejected') return raw;
  return 'draft';
}

function buildNotificationMeta(bulletin, scenarioKey, stepKey) {
  return {
    origin: 'emergency_layer',
    bulletinId: bulletin && bulletin.id ? bulletin.id : null,
    providerKey: bulletin && bulletin.providerKey ? bulletin.providerKey : null,
    severity: normalizeSeverity(bulletin && bulletin.severity),
    category: normalizeCategory(bulletin && bulletin.category),
    scenarioKey,
    stepKey
  };
}

function toNotificationPayload(bulletin, scenarioKey, stepKey, actor, ctaText) {
  const linkRegistryId = normalizeString(bulletin && bulletin.linkRegistryId);
  return {
    title: resolveTitle(bulletin),
    body: resolveMessageDraft(bulletin),
    ctaText,
    ctas: [{ text: ctaText }],
    linkRegistryId,
    scenarioKey,
    stepKey,
    target: {
      region: normalizeString(bulletin && bulletin.regionKey),
      membersOnly: false,
      limit: 500
    },
    notificationCategory: 'IMMEDIATE_ACTION',
    notificationType: 'GENERAL',
    status: 'active',
    createdBy: actor,
    notificationMeta: buildNotificationMeta(bulletin, scenarioKey, stepKey)
  };
}

function isNoRecipientsError(err) {
  const message = err && err.message ? String(err.message).trim().toLowerCase() : '';
  return message === 'no recipients';
}

async function validatePreconditions(payload, deps) {
  const params = payload && typeof payload === 'object' ? payload : {};
  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;
  const killSwitchOn = await getKillSwitch();
  if (killSwitchOn) {
    return {
      ok: false,
      blocked: true,
      reason: 'kill_switch_on',
      failureCode: FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH
    };
  }

  const linkRegistryId = normalizeString(params.bulletin && params.bulletin.linkRegistryId);
  if (!linkRegistryId) {
    return {
      ok: false,
      blocked: true,
      reason: 'MISSING_LINK_REGISTRY_ID',
      failureCode: FAILURE_CODES.MISSING_LINK_REGISTRY_ID
    };
  }

  const getLink = deps && typeof deps.getLink === 'function' ? deps.getLink : linkRegistryRepo.getLink;
  const linkEntry = await getLink(linkRegistryId);
  if (!linkEntry) {
    return {
      ok: false,
      blocked: true,
      reason: 'MISSING_LINK_REGISTRY_ID',
      failureCode: FAILURE_CODES.MISSING_LINK_REGISTRY_ID
    };
  }

  const healthState = linkEntry && linkEntry.lastHealth && typeof linkEntry.lastHealth.state === 'string'
    ? linkEntry.lastHealth.state
    : null;
  if (healthState === 'WARN') {
    return {
      ok: false,
      blocked: true,
      reason: 'GUARD_BLOCK_WARN_LINK',
      failureCode: FAILURE_CODES.GUARD_BLOCK_WARN_LINK
    };
  }

  const ctaText = resolveCtaText(params.ctaText);
  if (!ctaText) {
    return {
      ok: false,
      blocked: true,
      reason: 'INVALID_CTA',
      failureCode: FAILURE_CODES.INVALID_CTA
    };
  }

  return {
    ok: true,
    ctaText,
    linkEntry
  };
}

async function approveEmergencyBulletin(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const bulletinId = normalizeString(payload.bulletinId);
  if (!bulletinId) throw new Error('bulletinId required');

  const now = resolveNow(payload, deps);
  const traceId = resolveTraceId(payload, now);
  const actor = resolveActor(payload);
  const requestId = normalizeString(payload.requestId);

  const bulletin = await emergencyBulletinsRepo.getBulletin(bulletinId);
  if (!bulletin) {
    return {
      ok: false,
      reason: 'bulletin_not_found',
      bulletinId,
      traceId
    };
  }

  const status = normalizeStatus(bulletin.status);
  if (status === 'sent') {
    return {
      ok: false,
      reason: 'bulletin_already_sent',
      bulletinId,
      traceId
    };
  }
  if (status === 'rejected') {
    return {
      ok: false,
      reason: 'bulletin_rejected',
      bulletinId,
      traceId
    };
  }

  const checks = await validatePreconditions({
    bulletin,
    ctaText: payload.ctaText
  }, deps);
  if (!checks.ok) {
    await appendEmergencyAudit({
      actor,
      action: 'emergency.bulletin.approve.blocked',
      entityType: 'emergency_bulletin',
      entityId: bulletinId,
      traceId,
      requestId,
      payloadSummary: {
        reason: checks.reason,
        failureCode: checks.failureCode
      }
    }, deps);
    return {
      ok: false,
      blocked: true,
      reason: checks.reason,
      failureCode: checks.failureCode,
      bulletinId,
      traceId
    };
  }

  const ctaText = checks.ctaText;
  const approvedAt = now.toISOString();

  await emergencyBulletinsRepo.updateBulletin(bulletinId, {
    status: 'approved',
    approvedBy: actor,
    approvedAt,
    traceId
  });

  await appendEmergencyAudit({
    actor,
    action: 'emergency.bulletin.approve.start',
    entityType: 'emergency_bulletin',
    entityId: bulletinId,
    traceId,
    requestId,
    payloadSummary: {
      statusBefore: status,
      fanoutCount: FANOUT_SCENARIOS.length * FANOUT_STEPS.length
    }
  }, deps);

  const createNotificationFn = deps && typeof deps.createNotification === 'function'
    ? deps.createNotification
    : createNotification;
  const sendNotificationFn = deps && typeof deps.sendNotification === 'function'
    ? deps.sendNotification
    : sendNotification;
  const getKillSwitch = deps && typeof deps.getKillSwitch === 'function'
    ? deps.getKillSwitch
    : systemFlagsRepo.getKillSwitch;

  const notifications = [];
  const deliveries = [];
  const failures = [];
  let killSwitchBlocked = false;

  for (const scenarioKey of FANOUT_SCENARIOS) {
    for (const stepKey of FANOUT_STEPS) {
      const killSwitchOn = await getKillSwitch();
      if (killSwitchOn) {
        killSwitchBlocked = true;
        failures.push({
          scenarioKey,
          stepKey,
          phase: 'guard',
          reason: 'kill_switch_on',
          failureCode: FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH
        });
        break;
      }

      const notificationPayload = toNotificationPayload(bulletin, scenarioKey, stepKey, actor, ctaText);
      let notificationId = null;
      try {
        const created = await createNotificationFn(notificationPayload);
        notificationId = created && created.id ? created.id : null;
        notifications.push({ notificationId, scenarioKey, stepKey });
      } catch (err) {
        failures.push({
          scenarioKey,
          stepKey,
          phase: 'create',
          reason: err && err.message ? String(err.message) : 'create_failed',
          failureCode: mapFailureCode(err)
        });
        continue;
      }

      if (!notificationId) {
        failures.push({
          scenarioKey,
          stepKey,
          phase: 'create',
          reason: 'notification_id_missing',
          failureCode: FAILURE_CODES.UNEXPECTED_EXCEPTION
        });
        continue;
      }

      try {
        const sendResult = await sendNotificationFn({
          notificationId,
          sentAt: approvedAt,
          killSwitch: killSwitchOn,
          traceId,
          requestId: requestId || undefined,
          actor
        });
        deliveries.push(Object.assign({ scenarioKey, stepKey, notificationId }, sendResult || {}));
      } catch (err) {
        if (isNoRecipientsError(err)) {
          deliveries.push({
            scenarioKey,
            stepKey,
            notificationId,
            deliveredCount: 0,
            skippedCount: 0,
            skippedByNoRecipients: true
          });
          continue;
        }
        failures.push({
          scenarioKey,
          stepKey,
          phase: 'send',
          notificationId,
          reason: err && err.message ? String(err.message) : 'send_failed',
          failureCode: mapFailureCode(err)
        });
      }
    }
    if (killSwitchBlocked) break;
  }

  const notificationIds = notifications
    .map((row) => row.notificationId)
    .filter(Boolean);
  const deliveredCount = deliveries
    .map((row) => Number(row && row.deliveredCount) || 0)
    .reduce((sum, value) => sum + value, 0);
  const skippedNoRecipientsCount = deliveries
    .filter((row) => row && row.skippedByNoRecipients === true)
    .length;

  if (killSwitchBlocked) {
    await emergencyBulletinsRepo.updateBulletin(bulletinId, {
      status: 'approved',
      notificationIds,
      sendResult: {
        ok: false,
        reason: 'kill_switch_on',
        deliveredCount,
        skippedNoRecipientsCount,
        failures,
        deliveries
      },
      traceId
    });

    await appendEmergencyAudit({
      actor,
      action: 'emergency.bulletin.approve.blocked',
      entityType: 'emergency_bulletin',
      entityId: bulletinId,
      traceId,
      requestId,
      payloadSummary: {
        reason: 'kill_switch_on',
        deliveredCount,
        notificationCount: notificationIds.length,
        failureCount: failures.length,
        skippedNoRecipientsCount
      }
    }, deps);

    return {
      ok: false,
      blocked: true,
      reason: 'kill_switch_on',
      failureCode: FAILURE_CODES.GUARD_BLOCK_KILL_SWITCH,
      bulletinId,
      traceId,
      deliveredCount,
      skippedNoRecipientsCount,
      notificationIds,
      failures
    };
  }

  if (failures.length > 0) {
    await emergencyBulletinsRepo.updateBulletin(bulletinId, {
      status: 'approved',
      notificationIds,
      sendResult: {
        ok: false,
        deliveredCount,
        skippedNoRecipientsCount,
        failures,
        deliveries
      },
      traceId
    });

    await appendEmergencyAudit({
      actor,
      action: 'emergency.bulletin.approve.partial',
      entityType: 'emergency_bulletin',
      entityId: bulletinId,
      traceId,
      requestId,
      payloadSummary: {
        deliveredCount,
        notificationCount: notificationIds.length,
        failureCount: failures.length,
        skippedNoRecipientsCount
      }
    }, deps);

    return {
      ok: false,
      reason: 'send_partial_failure',
      bulletinId,
      traceId,
      deliveredCount,
      skippedNoRecipientsCount,
      notificationIds,
      failures
    };
  }

  const sentAt = new Date().toISOString();
  await emergencyBulletinsRepo.updateBulletin(bulletinId, {
    status: 'sent',
    sentAt,
    notificationIds,
    sendResult: {
      ok: true,
      deliveredCount,
      skippedNoRecipientsCount,
      deliveries
    },
    traceId
  });

  await appendEmergencyAudit({
    actor,
    action: 'emergency.bulletin.approve.sent',
    entityType: 'emergency_bulletin',
    entityId: bulletinId,
    traceId,
    requestId,
    payloadSummary: {
      deliveredCount,
      notificationCount: notificationIds.length,
      skippedNoRecipientsCount
    }
  }, deps);

  return {
    ok: true,
    bulletinId,
    traceId,
    deliveredCount,
    skippedNoRecipientsCount,
    notificationIds,
    status: 'sent'
  };
}

module.exports = {
  approveEmergencyBulletin
};
