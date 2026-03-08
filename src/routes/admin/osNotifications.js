'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { createNotification } = require('../../usecases/notifications/createNotification');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { approveNotification } = require('../../usecases/adminOs/approveNotification');
const { previewNotification } = require('../../usecases/adminOs/previewNotification');
const { planNotificationSend } = require('../../usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../usecases/adminOs/executeNotificationSend');
const { logReadPathLoadMetric } = require('../../ops/readPathLoadMetric');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const { requireActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');
const { resolveNotificationCtaAuditSummary } = require('../../domain/notificationCtaAudit');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);

function handleError(res, err, context) {
  const message = err && err.message ? err.message : 'error';
  const explicitStatusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : null;
  const hasFailureCode = err && typeof err.failureCode === 'string' && err.failureCode.trim().length > 0;
  const traceId = context && context.traceId ? context.traceId : null;
  const requestId = context && context.requestId ? context.requestId : null;
  if (explicitStatusCode && explicitStatusCode >= 400 && explicitStatusCode < 500) {
    res.writeHead(explicitStatusCode, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
    return;
  }
  if (hasFailureCode) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
    return;
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('not editable')
    || message.includes('not active') || message.includes('not found') || message.includes('no recipients')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  logRouteError('admin.os_notifications', err, context);
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
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
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId, notificationId: created.id }));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
  }
}

async function handlePreview(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ traceId, requestId }, result)));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
  }
}

async function handleApprove(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ traceId: guardedTraceId, requestId }, result)));
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor });
  }
}

async function handleSendPlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor });
  }
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const notificationId = url.searchParams.get('notificationId');
  if (!notificationId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'notificationId required' }));
    return;
  }
  try {
    const notification = await notificationsRepo.getNotification(notificationId);
    if (!notification) {
      res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'notification not found' }));
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      notificationId,
      status: notification.status || null,
      notificationCategory: notification.notificationCategory || null,
      [SCENARIO_KEY_FIELD]: notification[SCENARIO_KEY_FIELD] || null,
      stepKey: notification.stepKey || null,
      title: notification.title || null
    }));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
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
  const actor = requireActor(req, res);
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId, items }));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
  }
}

async function handleArchive(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  const notificationIds = Array.isArray(payload.notificationIds)
    ? Array.from(new Set(payload.notificationIds.filter((id) => typeof id === 'string' && id.trim()).map((id) => id.trim())))
    : [];
  if (!notificationIds.length) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'notificationIds required', traceId, requestId }));
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      archivedCount: Number(result && result.updatedCount ? result.updatedCount : 0)
    }));
  } catch (err) {
    handleError(res, err, { traceId, requestId, actor });
  }
}

async function handleSendExecute(req, res, body, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
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
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err, { traceId: guardedTraceId, requestId, actor: guardedActor });
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
