'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { createNotification } = require('../../usecases/notifications/createNotification');
const { approveNotification } = require('../../usecases/adminOs/approveNotification');
const { previewNotification } = require('../../usecases/adminOs/previewNotification');
const { planNotificationSend } = require('../../usecases/adminOs/planNotificationSend');
const { executeNotificationSend } = require('../../usecases/adminOs/executeNotificationSend');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid') || message.includes('not editable')
    || message.includes('not active') || message.includes('not found') || message.includes('no recipients')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
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
      payloadSummary: { title: payload.title || null }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId, notificationId: created.id }));
  } catch (err) {
    handleError(res, err);
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
    handleError(res, err);
  }
}

async function handleApprove(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await approveNotification({ notificationId: payload.notificationId, actor });
    await appendAuditLog({
      actor,
      action: 'notifications.approve',
      entityType: 'notification',
      entityId: payload.notificationId,
      traceId,
      requestId,
      payloadSummary: { status: 'active' }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({ traceId, requestId }, result)));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleSendPlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await planNotificationSend({
      notificationId: payload.notificationId,
      actor,
      traceId,
      requestId
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleSendExecute(req, res, body, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await executeNotificationSend({
      notificationId: payload.notificationId,
      planHash: payload.planHash,
      confirmToken: payload.confirmToken,
      actor,
      traceId,
      requestId
    }, deps);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(result));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleDraft,
  handlePreview,
  handleApprove,
  handleSendPlan,
  handleSendExecute
};

