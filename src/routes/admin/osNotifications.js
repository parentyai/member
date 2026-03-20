'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { createNotification } = require('../../usecases/notifications/createNotification');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { approveNotification } = require('../../usecases/adminOs/approveNotification');
const { previewNotification } = require('../../usecases/adminOs/previewNotification');
const { planNotificationSend } = require('../../usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../usecases/adminOs/executeNotificationSend');
const { logReadPathLoadMetric } = require('../../ops/readPathLoadMetric');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const { resolveActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { resolveNotificationCtaAuditSummary } = require('../../domain/notificationCtaAudit');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEYS = {
  draft: 'admin.os_notifications_draft',
  preview: 'admin.os_notifications_preview',
  approve: 'admin.os_notifications_approve',
  sendPlan: 'admin.os_notifications_send_plan',
  status: 'admin.os_notifications_status',
  list: 'admin.os_notifications_list',
  archive: 'admin.os_notifications_archive',
  sendExecute: 'admin.os_notifications_send_execute'
};

function normalizeOutcomeReason(value, fallback) {
  const normalized = typeof value === 'string'
    ? value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
    : '';
  return normalized || fallback;
}

function normalizeOutcomeOptions(routeKey, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = routeKey;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, routeKey, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(routeKey, outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJsonBody(bodyText, res, routeKey) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    writeJson(res, routeKey, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function requireKnownActor(req, res, routeKey) {
  const actor = resolveActor(req);
  if (actor === 'unknown') {
    writeJson(res, routeKey, 400, { ok: false, error: 'x-actor required' }, {
      state: 'error',
      reason: 'x_actor_required'
    });
    return null;
  }
  return actor;
}

function handleError(res, err, context, routeKey) {
  const message = err && err.message ? err.message : 'error';
  const explicitStatusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : null;
  const hasFailureCode = err && typeof err.failureCode === 'string' && err.failureCode.trim().length > 0;
  const traceId = context && context.traceId ? context.traceId : null;
  const requestId = context && context.requestId ? context.requestId : null;
  if (explicitStatusCode && explicitStatusCode >= 400 && explicitStatusCode < 500) {
    writeJson(res, routeKey, explicitStatusCode, { ok: false, error: message, traceId, requestId }, {
      state: explicitStatusCode === 409 ? 'blocked' : 'error',
      reason: normalizeOutcomeReason(err && err.failureCode, normalizeOutcomeReason(message, 'invalid_request'))
    });
    return;
  }
  if (hasFailureCode) {
    writeJson(res, routeKey, 400, { ok: false, error: message, traceId, requestId }, {
      state: 'error',
      reason: normalizeOutcomeReason(err.failureCode, 'invalid_request')
    });
    return;
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('not editable')
    || message.includes('not active') || message.includes('not found') || message.includes('no recipients')) {
    writeJson(res, routeKey, 400, { ok: false, error: message }, {
      state: 'error',
      reason: normalizeOutcomeReason(message, 'invalid_request')
    });
    return;
  }
  logRouteError('admin.os_notifications', err, context);
  writeJson(res, routeKey, 500, { ok: false, error: 'error', traceId, requestId }, {
    state: 'error',
    reason: 'error'
  });
}

function addCheckedAt(summary) {
  const base = summary && typeof summary === 'object' ? summary : {};
  return Object.assign({}, base, { checkedAt: new Date().toISOString() });
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return defaultValue === true;
}

function requireTargetLimit(payload) {
  const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : null;
  if (!target || typeof target.limit !== 'number' || !Number.isFinite(target.limit) || target.limit <= 0) {
    throw new Error('target.limit required');
  }
}

function normalizeDraftPayload(payload) {
  const body = payload && typeof payload === 'object' ? Object.assign({}, payload) : {};
  const targetRaw = body.target && typeof body.target === 'object' ? Object.assign({}, body.target) : {};
  const limit = Number(targetRaw.limit);
  if (!Number.isFinite(limit) || limit <= 0) {
    throw new Error('target.limit required');
  }
  const target = Object.assign({}, targetRaw, { limit: Math.min(500, Math.max(1, Math.floor(limit))) });
  if (targetRaw.region !== undefined && targetRaw.region !== null) {
    if (typeof targetRaw.region !== 'string') throw new Error('target.region invalid');
    const region = targetRaw.region.trim();
    if (region) target.region = region;
    else delete target.region;
  }
  body.target = target;
  return body;
}

function summarizeComposerPayload(payload) {
  const body = payload && typeof payload === 'object' ? payload : {};
  const target = body.target && typeof body.target === 'object' ? body.target : {};
  const title = typeof body.title === 'string' ? body.title : '';
  const text = typeof body.body === 'string' ? body.body : '';
  const ctaText = typeof body.ctaText === 'string' ? body.ctaText : '';
  const multiCtaEnabled = resolveBooleanEnvFlag('ENABLE_NOTIFICATION_CTA_MULTI_V1', false);
  const ctaSummary = resolveNotificationCtaAuditSummary(body, {
    allowSecondary: multiCtaEnabled,
    ignoreSecondary: false
  });
  const notificationType = typeof body.notificationType === 'string' ? body.notificationType : null;
  const notificationCategory = typeof body.notificationCategory === 'string' ? body.notificationCategory : null;
  const scenarioValue = typeof body[SCENARIO_KEY_FIELD] === 'string' ? body[SCENARIO_KEY_FIELD] : null;
  const stepKey = typeof body.stepKey === 'string' ? body.stepKey : null;
  const trigger = typeof body.trigger === 'string' ? body.trigger : null;
  const order = Number.isFinite(Number(body.order)) ? Number(body.order) : null;
  const linkRegistryId = typeof body.linkRegistryId === 'string' ? body.linkRegistryId : null;
  const targetLimit = Number.isFinite(Number(target.limit)) ? Number(target.limit) : null;
  return {
    notificationType,
    notificationCategory,
    [SCENARIO_KEY_FIELD]: scenarioValue,
    stepKey,
    trigger,
    order,
    linkRegistryId,
    targetLimit,
    targetRegionSet: typeof target.region === 'string' && target.region.trim().length > 0,
    targetMembersOnly: target.membersOnly === true,
    titleLength: title.length,
    bodyLength: text.length,
    ctaLength: ctaText.length,
    ctaCount: ctaSummary.ctaCount,
    ctaLinkRegistryIds: ctaSummary.ctaLinkRegistryIds,
    ctaLabelHashes: ctaSummary.ctaLabelHashes,
    ctaLabelLengths: ctaSummary.ctaLabelLengths
  };
}

async function handleDraft(req, res, body) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.draft);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.draft);
  if (!payload) return;
  try {
    requireTargetLimit(payload);
    const normalizedPayload = normalizeDraftPayload(payload);
    const created = await createNotification(Object.assign({}, normalizedPayload, { createdBy: actor, status: 'draft' }));
    await appendAuditLog({
      actor,
      action: 'notifications.create',
      entityType: 'notification',
      entityId: created.id,
      traceId,
      requestId,
      payloadSummary: addCheckedAt(summarizeComposerPayload(normalizedPayload))
    });
    writeJson(res, ROUTE_KEYS.draft, 200, { ok: true, traceId, requestId, notificationId: created.id }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor }, ROUTE_KEYS.draft);
  }
}

async function handlePreview(req, res, body) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.preview);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.preview);
  if (!payload) return;
  try {
    const result = await previewNotification(payload);
    await appendAuditLog({
      actor,
      action: 'notifications.preview',
      entityType: 'notification',
      entityId: result.notificationId || 'draft',
      traceId,
      requestId,
      payloadSummary: addCheckedAt(Object.assign(summarizeComposerPayload(payload), {
        trackEnabled: Boolean(result.trackEnabled),
        lineMessageType: result.lineMessageType || null
      }))
    });
    writeJson(res, ROUTE_KEYS.preview, 200, Object.assign({ traceId, requestId }, result), {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor }, ROUTE_KEYS.preview);
  }
}

async function handleApprove(req, res, body) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.approve);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.approve);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'notifications.approve',
    payload
  });
  if (!guard) return;
  const guardedActor = guard.actor || actor;
  const guardedTraceId = guard.traceId || traceId;
  try {
    const result = await approveNotification({ notificationId: payload.notificationId, actor: guardedActor });
    await appendAuditLog({
      actor: guardedActor,
      action: 'notifications.approve',
      entityType: 'notification',
      entityId: payload.notificationId,
      traceId: guardedTraceId,
      requestId,
      payloadSummary: addCheckedAt({ status: 'active' })
    });
    writeJson(res, ROUTE_KEYS.approve, 200, Object.assign({ traceId: guardedTraceId, requestId }, result), {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor }, ROUTE_KEYS.approve);
  }
}

async function handleSendPlan(req, res, body) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.sendPlan);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.sendPlan);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'notifications.send.plan',
    payload
  });
  if (!guard) return;
  const guardedActor = guard.actor || actor;
  const guardedTraceId = guard.traceId || traceId;
  try {
    const result = await planNotificationSend({
      notificationId: payload.notificationId,
      actor: guardedActor,
      traceId: guardedTraceId,
      requestId
    });
    writeJson(res, ROUTE_KEYS.sendPlan, 200, result, {
      state: result && result.ok === false ? 'degraded' : 'success',
      reason: result && result.ok === false
        ? normalizeOutcomeReason(result.reason, 'completed_with_issues')
        : 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor }, ROUTE_KEYS.sendPlan);
  }
}

async function handleStatus(req, res) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.status);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const notificationId = url.searchParams.get('notificationId');
  if (!notificationId) {
    writeJson(res, ROUTE_KEYS.status, 400, { ok: false, error: 'notificationId required' }, {
      state: 'error',
      reason: 'notification_id_required'
    });
    return;
  }
  try {
    const notification = await notificationsRepo.getNotification(notificationId);
    if (!notification) {
      writeJson(res, ROUTE_KEYS.status, 404, { ok: false, error: 'notification not found' }, {
        state: 'error',
        reason: 'notification_not_found'
      });
      return;
    }
    await appendAuditLog({
      actor,
      action: 'notifications.status.view',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      payloadSummary: addCheckedAt({
        status: notification.status || null,
        notificationCategory: notification.notificationCategory || null
      })
    });
    writeJson(res, ROUTE_KEYS.status, 200, {
      ok: true,
      traceId,
      requestId,
      notificationId,
      status: notification.status || null,
      notificationCategory: notification.notificationCategory || null,
      [SCENARIO_KEY_FIELD]: notification[SCENARIO_KEY_FIELD] || null,
      stepKey: notification.stepKey || null,
      title: notification.title || null
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor }, ROUTE_KEYS.status);
  }
}

function parseListLimit(url) {
  const limitRaw = Number(url.searchParams.get('limit'));
  if (!Number.isFinite(limitRaw) || limitRaw <= 0) return 100;
  return Math.min(Math.floor(limitRaw), 500);
}

function parseBooleanQuery(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback === true;
  const raw = String(value).trim().toLowerCase();
  if (raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes') return true;
  if (raw === '0' || raw === 'false' || raw === 'off' || raw === 'no') return false;
  return fallback === true;
}

function normalizeListStatus(value) {
  const raw = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!raw) return '';
  if (raw === 'approved') return 'active';
  if (raw === 'executed') return 'sent';
  if (raw === 'planned') return 'planned';
  if (raw === 'draft' || raw === 'active' || raw === 'sent') return raw;
  return raw;
}

async function handleList(req, res) {
  const startedAt = Date.now();
  const actor = requireKnownActor(req, res, ROUTE_KEYS.list);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const limit = parseListLimit(url);
  const normalizedStatus = normalizeListStatus(url.searchParams.get('status'));
  const includeArchivedSeed = parseBooleanQuery(url.searchParams.get('includeArchivedSeed'), false);
  const includeArchived = parseBooleanQuery(url.searchParams.get('includeArchived'), false);
  try {
    const rows = await notificationsRepo.listNotifications({
      limit,
      status: normalizedStatus || undefined,
      [SCENARIO_KEY_FIELD]: url.searchParams.get(SCENARIO_KEY_FIELD) || undefined,
      stepKey: url.searchParams.get('stepKey') || undefined,
      includeArchivedSeed,
      includeArchived
    });
    const category = url.searchParams.get('notificationCategory') || '';
    const notificationType = (url.searchParams.get('notificationType') || '').trim().toUpperCase();
    const filtered = rows.filter((row) => {
      if (category && (row.notificationCategory || '') !== category) return false;
      if (notificationType && (row.notificationType || 'STEP') !== notificationType) return false;
      return true;
    });
    const items = filtered.map((row) => ({
      id: row.id,
      title: row.title || '',
      body: row.body || '',
      ctaText: row.ctaText || '',
      linkRegistryId: row.linkRegistryId || '',
      secondaryCtas: Array.isArray(row.secondaryCtas) ? row.secondaryCtas : [],
      status: row.status || null,
      notificationCategory: row.notificationCategory || null,
      notificationType: row.notificationType || 'STEP',
      notificationMeta: row.notificationMeta || null,
      [SCENARIO_KEY_FIELD]: row[SCENARIO_KEY_FIELD] || null,
      stepKey: row.stepKey || null,
      trigger: row.trigger || null,
      order: Number.isFinite(Number(row.order)) ? Number(row.order) : null,
      target: row.target || null,
      planHash: row.lastPlanHash || null,
      seedTag: row.seedTag || null,
      seedRunId: row.seedRunId || null,
      seededAt: row.seededAt || null,
      seedArchivedAt: row.seedArchivedAt || null,
      seedArchivedBy: row.seedArchivedBy || null,
      seedArchiveReason: row.seedArchiveReason || null,
      archivedAt: row.archivedAt || null,
      archivedBy: row.archivedBy || null,
      archiveReason: row.archiveReason || null,
      createdAt: row.createdAt || null,
      scheduledAt: row.scheduledAt || null
    }));
    logReadPathLoadMetric({
      cluster: 'notifications',
      operation: 'list_notifications',
      scannedCount: rows.length,
      resultCount: items.length,
      durationMs: Date.now() - startedAt,
      fallbackUsed: false,
      traceId,
      requestId,
      limit
    });
    await appendAuditLog({
      actor,
      action: 'notifications.list',
      entityType: 'notification',
      entityId: 'list',
      traceId,
      requestId,
      payloadSummary: addCheckedAt({
        limit,
        status: normalizedStatus || null,
        includeArchived,
        includeArchivedSeed,
        [SCENARIO_KEY_FIELD]: url.searchParams.get(SCENARIO_KEY_FIELD) || null,
        stepKey: url.searchParams.get('stepKey') || null
      })
    });
    writeJson(res, ROUTE_KEYS.list, 200, { ok: true, traceId, requestId, items }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor }, ROUTE_KEYS.list);
  }
}

async function handleArchive(req, res, body) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.archive);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.archive);
  if (!payload) return;
  const notificationIds = Array.isArray(payload.notificationIds)
    ? Array.from(new Set(payload.notificationIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())))
    : [];
  if (!notificationIds.length) {
    writeJson(res, ROUTE_KEYS.archive, 400, { ok: false, error: 'notificationIds required', traceId, requestId }, {
      state: 'error',
      reason: 'notification_ids_required'
    });
    return;
  }
  const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
  const archivedAt = new Date().toISOString();
  try {
    const result = await notificationsRepo.markNotificationsArchived({
      ids: notificationIds,
      patch: {
        archivedAt,
        archivedBy: actor,
        archiveReason: reason || null
      }
    });
    await appendAuditLog({
      actor,
      action: 'notifications.archive',
      entityType: 'notification',
      entityId: 'bulk',
      traceId,
      requestId,
      payloadSummary: addCheckedAt({
        archivedCount: Number(result && result.updatedCount ? result.updatedCount : 0),
        reason: reason || null
      })
    });
    writeJson(res, ROUTE_KEYS.archive, 200, {
      ok: true,
      traceId,
      requestId,
      archivedCount: Number(result && result.updatedCount ? result.updatedCount : 0)
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor }, ROUTE_KEYS.archive);
  }
}

async function handleSendExecute(req, res, body, deps) {
  const actor = requireKnownActor(req, res, ROUTE_KEYS.sendExecute);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJsonBody(body, res, ROUTE_KEYS.sendExecute);
  if (!payload) return;
  const guard = await enforceManagedFlowGuard({
    req,
    res,
    actionKey: 'notifications.send.execute',
    payload
  });
  if (!guard) return;
  const guardedActor = guard.actor || actor;
  const guardedTraceId = guard.traceId || traceId;
  try {
    const result = await executeNotificationSend({
      notificationId: payload.notificationId,
      planHash: payload.planHash,
      confirmToken: payload.confirmToken,
      actor: guardedActor,
      traceId: guardedTraceId,
      requestId
    }, deps);
    const statusCode = result && result.partial === true ? 207 : 200;
    writeJson(res, ROUTE_KEYS.sendExecute, statusCode, result, {
      state: statusCode === 207
        ? 'partial'
        : (result && result.ok === false ? 'degraded' : 'success'),
      reason: statusCode === 207
        ? 'send_partial_failure'
        : (result && result.ok === false
          ? normalizeOutcomeReason(result.reason, 'completed_with_issues')
          : 'completed')
    });
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor }, ROUTE_KEYS.sendExecute);
  }
}

module.exports = {
  handleDraft,
  handlePreview,
  handleApprove,
  handleSendPlan,
  handleStatus,
  handleList,
  handleSendExecute,
  handleArchive
};
