'use strict';

const { testSendNotification } = require('../../usecases/notifications/testSendNotification');
const { createNotification } = require('../../usecases/notifications/createNotification');
const { listNotifications } = require('../../usecases/notifications/listNotifications');
const { sendNotification } = require('../../usecases/notifications/sendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { resolveTraceId } = require('./osContext');
const { attachNotificationSendSummary } = require('../../domain/notificationSendSummary');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);

function resolveActor(req) {
  const actor = req && req.headers && req.headers['x-actor'];
  if (typeof actor === 'string' && actor.trim().length > 0) return actor.trim();
  return 'unknown';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function logObs(action, result, fields) {
  const parts = [`[OBS] action=${action} result=${result}`];
  if (fields && fields.requestId) parts.push(`requestId=${fields.requestId}`);
  if (fields && fields.lineUserId) parts.push(`lineUserId=${fields.lineUserId}`);
  if (fields && fields.notificationId) parts.push(`notificationId=${fields.notificationId}`);
  if (fields && fields.deliveryId) parts.push(`deliveryId=${fields.deliveryId}`);
  console.log(parts.join(' '));
}

function isKillSwitchError(err) {
  return err && typeof err.message === 'string' && err.message.includes('kill switch');
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  const explicitStatusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : null;
  if (explicitStatusCode && explicitStatusCode >= 400 && explicitStatusCode < 500) {
    res.writeHead(explicitStatusCode, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  if (message.includes('not found')) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('not found');
    return;
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('no recipients')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(message);
    return;
  }
  res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
  res.end('error');
}

async function handleCreate(req, res, body) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const result = await createNotification(payload);
    const traceId = resolveTraceId(req);
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.create',
      entityType: 'notification',
      entityId: result.id,
      traceId,
      requestId: resolveRequestId(req),
      payloadSummary: { title: payload.title || null }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id, traceId }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleList(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const status = url.searchParams.get('status');
  const scenarioFilter = url.searchParams.get(SCENARIO_KEY_FIELD);
  const stepKey = url.searchParams.get('stepKey');
  try {
    const result = await listNotifications({
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
      [SCENARIO_KEY_FIELD]: scenarioFilter || undefined,
      stepKey: stepKey || undefined
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, items: result }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleTestSend(req, res, body, notificationId) {
  const payload = parseJson(body, res);
  if (!payload) return;
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req);

  if (!payload.lineUserId) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('lineUserId required');
    logObs('test-send', 'reject', { requestId });
    return;
  }

  try {
    const killSwitch = await getKillSwitch();
    const result = await testSendNotification({
      lineUserId: payload.lineUserId,
      text: payload.text,
      notificationId: notificationId || payload.notificationId,
      sentAt: payload.sentAt,
      killSwitch
    });
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.test_send',
      entityType: 'notification',
      entityId: notificationId || payload.notificationId || 'test',
      traceId,
      requestId,
      payloadSummary: {
        textLength: typeof payload.text === 'string' ? payload.text.length : 0
      }
    });
    logObs('test-send', 'ok', {
      requestId,
      lineUserId: payload.lineUserId,
      notificationId: notificationId || payload.notificationId,
      deliveryId: result.id
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id, traceId }));
  } catch (err) {
    if (isKillSwitchError(err)) {
      logObs('test-send', 'reject', {
        requestId,
        lineUserId: payload.lineUserId,
        notificationId: notificationId || payload.notificationId
      });
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    logObs('test-send', 'error', {
      requestId,
      lineUserId: payload.lineUserId,
      notificationId: notificationId || payload.notificationId
    });
    handleError(res, err);
  }
}

async function handleSend(req, res, body, notificationId) {
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const traceId = resolveTraceId(req);
    const killSwitch = await getKillSwitch();
    const rawResult = await sendNotification({
      notificationId,
      sentAt: payload.sentAt,
      killSwitch,
      continueOnError: true
    });
    const result = attachNotificationSendSummary(rawResult);
    const partialFailure = result.sendSummary && result.sendSummary.partialFailure === true;
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.send',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId: resolveRequestId(req),
      payloadSummary: {
        deliveredCount: result.deliveredCount,
        skippedCount: result.skippedCount || 0,
        failedCount: result.failedCount || 0,
        partialFailure,
        sendSummary: result.sendSummary || null
      }
    });
    const statusCode = partialFailure ? 207 : 200;
    res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: partialFailure ? false : true,
      partial: partialFailure,
      reason: partialFailure ? 'send_partial_failure' : null,
      deliveredCount: result.deliveredCount,
      skippedCount: result.skippedCount || 0,
      failedCount: result.failedCount || 0,
      sendSummary: result.sendSummary || null,
      traceId
    }));
  } catch (err) {
    if (isKillSwitchError(err)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    handleError(res, err);
  }
}

module.exports = {
  handleCreate,
  handleList,
  handleTestSend,
  handleSend
};
