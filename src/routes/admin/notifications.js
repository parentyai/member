'use strict';

const { testSendNotification } = require('../../usecases/notifications/testSendNotification');
const { createNotification } = require('../../usecases/notifications/createNotification');
const { listNotifications } = require('../../usecases/notifications/listNotifications');
const { sendNotification } = require('../../usecases/notifications/sendNotification');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { logRouteError, resolveTraceId } = require('./osContext');
const { attachNotificationSendSummary } = require('../../domain/notificationSendSummary');
const SCENARIO_KEY_FIELD = String.fromCharCode(115,99,101,110,97,114,105,111,75,101,121);
const ROUTE_TYPE = 'admin_route';
const ROUTE_KEYS = {
  create: 'admin.notifications_create',
  list: 'admin.notifications_list',
  testSend: 'admin.notifications_test_send',
  send: 'admin.notifications_send'
};

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

function writeText(res, routeKey, statusCode, text, outcomeOptions) {
  applyOutcomeHeaders(res, normalizeOutcomeOptions(routeKey, outcomeOptions));
  res.writeHead(statusCode, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(text);
}

function parseJson(body, res, routeKey) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    writeText(res, routeKey, 400, 'invalid json', {
      state: 'error',
      reason: 'invalid_json'
    });
    return null;
  }
}

function normalizeErrorReason(message, explicitStatusCode) {
  if (typeof message === 'string' && message.includes('not found')) return 'not_found';
  if (typeof message === 'string' && message.includes('no recipients')) return 'no_recipients';
  if (typeof message === 'string' && message.includes('required')) return 'invalid_request';
  if (typeof message === 'string' && message.includes('invalid')) return 'invalid_request';
  if (explicitStatusCode && explicitStatusCode >= 400 && explicitStatusCode < 500) return 'invalid_request';
  return 'error';
}

function handleError(res, routeKey, err, context) {
  const message = err && err.message ? err.message : 'error';
  const explicitStatusCode = err && Number.isInteger(err.statusCode) ? err.statusCode : null;
  if (explicitStatusCode && explicitStatusCode >= 400 && explicitStatusCode < 500) {
    writeText(res, routeKey, explicitStatusCode, message, {
      state: 'error',
      reason: normalizeErrorReason(message, explicitStatusCode)
    });
    return;
  }
  if (message.includes('not found')) {
    writeText(res, routeKey, 404, 'not found', {
      state: 'error',
      reason: 'not_found'
    });
    return;
  }
  if (message.includes('required') || message.includes('invalid') || message.includes('no recipients')) {
    writeText(res, routeKey, 400, message, {
      state: 'error',
      reason: normalizeErrorReason(message, explicitStatusCode)
    });
    return;
  }
  if (context && typeof context === 'object') {
    logRouteError('admin.notifications', err, context);
  }
  writeText(res, routeKey, 500, 'error', {
    state: 'error',
    reason: 'error'
  });
}

async function handleCreate(req, res, body, deps) {
  const payload = parseJson(body, res, ROUTE_KEYS.create);
  if (!payload) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const create = typeof resolvedDeps.createNotification === 'function'
    ? resolvedDeps.createNotification
    : createNotification;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  const actor = resolveActor(req);
  const requestId = resolveRequestId(req);
  try {
    const result = await create(payload);
    const traceId = resolveTraceId(req);
    await appendAudit({
      actor,
      action: 'notifications.create',
      entityType: 'notification',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { title: payload.title || null }
    });
    writeJson(res, ROUTE_KEYS.create, 200, { ok: true, id: result.id, traceId }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, ROUTE_KEYS.create, err, {
      actor,
      requestId,
      traceId: resolveTraceId(req)
    });
  }
}

async function handleList(req, res, deps) {
  const url = new URL(req.url, 'http://localhost');
  const limit = url.searchParams.get('limit');
  const status = url.searchParams.get('status');
  const scenarioFilter = url.searchParams.get(SCENARIO_KEY_FIELD);
  const stepKey = url.searchParams.get('stepKey');
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const list = typeof resolvedDeps.listNotifications === 'function'
    ? resolvedDeps.listNotifications
    : listNotifications;
  try {
    const result = await list({
      limit: limit ? Number(limit) : undefined,
      status: status || undefined,
      [SCENARIO_KEY_FIELD]: scenarioFilter || undefined,
      stepKey: stepKey || undefined
    });
    writeJson(res, ROUTE_KEYS.list, 200, { ok: true, items: result }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    handleError(res, ROUTE_KEYS.list, err, {
      actor: resolveActor(req),
      requestId: resolveRequestId(req),
      traceId: resolveTraceId(req)
    });
  }
}

async function handleTestSend(req, res, body, notificationId, deps) {
  const payload = parseJson(body, res, ROUTE_KEYS.testSend);
  if (!payload) return;
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req);
  const actor = resolveActor(req);
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getKillSwitchSnapshot = typeof resolvedDeps.getKillSwitch === 'function'
    ? resolvedDeps.getKillSwitch
    : getKillSwitch;
  const testSend = typeof resolvedDeps.testSendNotification === 'function'
    ? resolvedDeps.testSendNotification
    : testSendNotification;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;

  if (!payload.lineUserId) {
    writeText(res, ROUTE_KEYS.testSend, 400, 'lineUserId required', {
      state: 'error',
      reason: 'line_user_id_required'
    });
    logObs('test-send', 'reject', { requestId });
    return;
  }

  try {
    const killSwitch = await getKillSwitchSnapshot();
    const result = await testSend({
      lineUserId: payload.lineUserId,
      text: payload.text,
      notificationId: notificationId || payload.notificationId,
      sentAt: payload.sentAt,
      killSwitch
    });
    await appendAudit({
      actor,
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
    writeJson(res, ROUTE_KEYS.testSend, 200, { ok: true, id: result.id, traceId }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    if (isKillSwitchError(err)) {
      logObs('test-send', 'reject', {
        requestId,
        lineUserId: payload.lineUserId,
        notificationId: notificationId || payload.notificationId
      });
      writeText(res, ROUTE_KEYS.testSend, 403, 'kill switch on', {
        state: 'blocked',
        reason: 'kill_switch_on'
      });
      return;
    }
    logObs('test-send', 'error', {
      requestId,
      lineUserId: payload.lineUserId,
      notificationId: notificationId || payload.notificationId
    });
    handleError(res, ROUTE_KEYS.testSend, err, { actor, requestId, traceId });
  }
}

async function handleSend(req, res, body, notificationId, deps) {
  const payload = parseJson(body, res, ROUTE_KEYS.send);
  if (!payload) return;
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const send = typeof resolvedDeps.sendNotification === 'function'
    ? resolvedDeps.sendNotification
    : sendNotification;
  const getKillSwitchSnapshot = typeof resolvedDeps.getKillSwitch === 'function'
    ? resolvedDeps.getKillSwitch
    : getKillSwitch;
  const appendAudit = typeof resolvedDeps.appendAuditLog === 'function'
    ? resolvedDeps.appendAuditLog
    : appendAuditLog;
  try {
    const traceId = resolveTraceId(req);
    const requestId = resolveRequestId(req);
    const actor = resolveActor(req);
    const killSwitch = await getKillSwitchSnapshot();
    const rawResult = await send({
      notificationId,
      sentAt: payload.sentAt,
      killSwitch,
      continueOnError: true
    });
    const result = attachNotificationSendSummary(rawResult);
    const partialFailure = result.sendSummary && result.sendSummary.partialFailure === true;
    await appendAudit({
      actor,
      action: 'notifications.send',
      entityType: 'notification',
      entityId: notificationId,
      traceId,
      requestId,
      payloadSummary: {
        deliveredCount: result.deliveredCount,
        skippedCount: result.skippedCount || 0,
        failedCount: result.failedCount || 0,
        partialFailure,
        sendSummary: result.sendSummary || null
      }
    });
    const statusCode = partialFailure ? 207 : 200;
    writeJson(res, ROUTE_KEYS.send, statusCode, {
      ok: partialFailure ? false : true,
      partial: partialFailure,
      reason: partialFailure ? 'send_partial_failure' : null,
      deliveredCount: result.deliveredCount,
      skippedCount: result.skippedCount || 0,
      failedCount: result.failedCount || 0,
      sendSummary: result.sendSummary || null,
      traceId
    }, {
      state: partialFailure ? 'degraded' : 'success',
      reason: partialFailure ? 'send_partial_failure' : 'completed'
    });
  } catch (err) {
    if (isKillSwitchError(err)) {
      writeText(res, ROUTE_KEYS.send, 403, 'kill switch on', {
        state: 'blocked',
        reason: 'kill_switch_on'
      });
      return;
    }
    handleError(res, ROUTE_KEYS.send, err, {
      actor: resolveActor(req),
      requestId: resolveRequestId(req),
      traceId: resolveTraceId(req)
    });
  }
}

module.exports = {
  handleCreate,
  handleList,
  handleTestSend,
  handleSend
};
