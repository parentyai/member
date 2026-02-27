'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { createNotification } = require('../../usecases/notifications/createNotification');
const notificationsRepo = require('../../repos/firestore/notificationsRepo');
const { approveNotification } = require('../../usecases/adminOs/approveNotification');
const { previewNotification } = require('../../usecases/adminOs/previewNotification');
const { planNotificationSend } = require('../../usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../usecases/adminOs/executeNotificationSend');
const { enforceManagedFlowGuard } = require('./managedFlowGuard');
const { requireActor, resolveRequestId, resolveTraceId, parseJson, logRouteError } = require('./osContext');

function handleError(res, err, context) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid') || message.includes('not editable')
    || message.includes('not active') || message.includes('not found') || message.includes('no recipients')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  const traceId = context && context.traceId ? context.traceId : null;
  const requestId = context && context.requestId ? context.requestId : null;
  logRouteError('admin.os_notifications', err, context);
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
}

function requireTargetLimit(payload) {
  const target = payload && payload.target && typeof payload.target === 'object' ? payload.target : null;
  if (!target || typeof target.limit !== 'number' || !Number.isFinite(target.limit) || target.limit <= 0) {
    throw new Error('target.limit required');
  }
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
    const created = await createNotification(Object.assign({}, payload, { createdBy: actor, status: 'draft' }));
    await appendAuditLog({
      actor,
      action: 'notifications.create',
      entityType: 'notification',
      entityId: created.id,
      traceId,
      requestId,
      payloadSummary: { title: payload.title || null, notificationCategory: payload.notificationCategory || null }
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
      payloadSummary: { trackEnabled: Boolean(result.trackEnabled) }
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
      payloadSummary: { status: 'active' }
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
      payloadSummary: {
        status: notification.status || null,
        notificationCategory: notification.notificationCategory || null
      }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      notificationId,
      status: notification.status || null,
      notificationCategory: notification.notificationCategory || null,
      scenarioKey: notification.scenarioKey || null,
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

async function handleList(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const url = new URL(req.url, 'http://localhost');
  const limit = parseListLimit(url);
  try {
    const rows = await notificationsRepo.listNotifications({
      limit,
      status: url.searchParams.get('status') || undefined,
      scenarioKey: url.searchParams.get('scenarioKey') || undefined,
      stepKey: url.searchParams.get('stepKey') || undefined
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
      status: row.status || null,
      notificationCategory: row.notificationCategory || null,
      notificationType: row.notificationType || 'STEP',
      notificationMeta: row.notificationMeta || null,
      scenarioKey: row.scenarioKey || null,
      stepKey: row.stepKey || null,
      target: row.target || null,
      createdAt: row.createdAt || null,
      scheduledAt: row.scheduledAt || null
    }));
    await appendAuditLog({
      actor,
      action: 'notifications.list',
      entityType: 'notification',
      entityId: 'list',
      traceId,
      requestId,
      payloadSummary: {
        limit,
        status: url.searchParams.get('status') || null,
        scenarioKey: url.searchParams.get('scenarioKey') || null,
        stepKey: url.searchParams.get('stepKey') || null
      }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId, items }));
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
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
  handleSendExecute
};
