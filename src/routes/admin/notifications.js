'use strict';

const { testSendNotification } = require('../../usecases/notifications/testSendNotification');
const { createNotification } = require('../../usecases/notifications/createNotification');
const { listNotifications } = require('../../usecases/notifications/listNotifications');
const { sendNotification } = require('../../usecases/notifications/sendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');

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
  console.log(parts.join(' ')); // WIP: Phase16-T01-OBS
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
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.create',
      entityType: 'notification',
      entityId: result.id,
      payloadSummary: { title: payload.title || null }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    handleError(res, err);
  }
}

async function handleList(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const status = url.searchParams.get('status');
  const scenarioKey = url.searchParams.get('scenarioKey');
  const stepKey = url.searchParams.get('stepKey');
  try {
    const result = await listNotifications({
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
      scenarioKey: scenarioKey || undefined,
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
    res.end(JSON.stringify({ ok: true, id: result.id }));
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
    const killSwitch = await getKillSwitch();
    const result = await sendNotification({
      notificationId,
      sentAt: payload.sentAt,
      killSwitch
    });
    await appendAuditLog({
      actor: resolveActor(req),
      action: 'notifications.send',
      entityType: 'notification',
      entityId: notificationId,
      payloadSummary: { deliveredCount: result.deliveredCount }
    });
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, deliveredCount: result.deliveredCount }));
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
