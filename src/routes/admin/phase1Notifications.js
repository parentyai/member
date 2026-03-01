'use strict';

const crypto = require('crypto');
const { createNotificationPhase1 } = require('../../usecases/notifications/createNotificationPhase1');
const { sendNotificationPhase1 } = require('../../usecases/notifications/sendNotificationPhase1');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../../repos/firestore/systemFlagsRepo');

const LEGACY_SUNSET = 'Wed, 30 Sep 2026 00:00:00 GMT';
const LEGACY_SUCCESSOR = '/api/admin/os/notifications/list';
const ROUTE_KEY = 'legacy_phase1_notifications';

function isLegacyRouteFreezeEnabled() {
  const raw = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return false; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function applyDeprecationHeaders(res, successorPath) {
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', LEGACY_SUNSET);
  if (typeof successorPath === 'string' && successorPath.trim().length > 0) {
    res.setHeader('Link', `<${successorPath.trim()}>; rel="successor-version"`);
  }
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
  const cloudTrace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof cloudTrace === 'string' && cloudTrace.trim()) return cloudTrace.split('/')[0];
  return `phase1_notifications_${crypto.randomUUID()}`;
}

function resolveTraceId(req, fallbackRequestId) {
  const traceId = req && req.headers && req.headers['x-trace-id'];
  if (typeof traceId === 'string' && traceId.trim()) return traceId.trim();
  return fallbackRequestId;
}

async function appendPhase1NotificationAuditBestEffort(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  try {
    await appendAuditLog({
      actor: data.actor || 'legacy_phase1_notifications_route',
      action: data.action || 'phase1.notifications.legacy',
      entityType: 'notification',
      entityId: data.entityId || 'unknown',
      traceId: data.traceId || null,
      requestId: data.requestId || null,
      payloadSummary: Object.assign({}, data.payloadSummary || {}, {
        guardRoute: ROUTE_KEY
      })
    });
  } catch (_err) {
    // best effort only
  }
}

function isKillSwitchError(err) {
  return err && typeof err.message === 'string' && err.message.includes('kill switch');
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
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

async function handleCreatePhase1(req, res, body) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  if (isLegacyRouteFreezeEnabled()) {
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.blocked',
      entityId: 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: { reason: 'legacy_route_frozen' }
    });
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) {
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.create.reject',
      entityId: 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: { reason: 'invalid_json' }
    });
    return;
  }
  try {
    const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
    if (safety.readError) {
      if (safety.failCloseMode === 'enforce') {
        await appendPhase1NotificationAuditBestEffort({
          action: 'phase1.notifications.create.blocked',
          entityId: 'legacy_phase1_notifications',
          traceId,
          requestId,
          payloadSummary: {
            reason: 'kill_switch_read_failed_fail_closed',
            failCloseMode: safety.failCloseMode
          }
        });
        applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('temporarily unavailable');
        return;
      }
      if (safety.failCloseMode === 'warn') {
        await appendPhase1NotificationAuditBestEffort({
          action: 'phase1.notifications.create.guard_warn',
          entityId: 'legacy_phase1_notifications',
          traceId,
          requestId,
          payloadSummary: {
            reason: 'kill_switch_read_failed_fail_open',
            failCloseMode: safety.failCloseMode
          }
        });
      }
    }
    if (safety.killSwitchOn) {
      await appendPhase1NotificationAuditBestEffort({
        action: 'phase1.notifications.create.blocked',
        entityId: 'legacy_phase1_notifications',
        traceId,
        requestId,
        payloadSummary: { reason: 'kill_switch_on' }
      });
      applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    const result = await createNotificationPhase1(payload);
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.create',
      entityId: result.id,
      traceId,
      requestId,
      payloadSummary: { ok: true }
    });
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, id: result.id }));
  } catch (err) {
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.create.error',
      entityId: 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        error: err && err.message ? err.message : 'error'
      }
    });
    handleError(res, err);
  }
}

async function handleSendPhase1(req, res, body, notificationId) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  if (isLegacyRouteFreezeEnabled()) {
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.blocked',
      entityId: notificationId || 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: { reason: 'legacy_route_frozen' }
    });
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen', replacement: LEGACY_SUCCESSOR }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) {
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.send.reject',
      entityId: notificationId || 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: { reason: 'invalid_json' }
    });
    return;
  }
  try {
    const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
    if (safety.readError) {
      if (safety.failCloseMode === 'enforce') {
        await appendPhase1NotificationAuditBestEffort({
          action: 'phase1.notifications.send.blocked',
          entityId: notificationId || 'legacy_phase1_notifications',
          traceId,
          requestId,
          payloadSummary: {
            reason: 'kill_switch_read_failed_fail_closed',
            failCloseMode: safety.failCloseMode
          }
        });
        applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('temporarily unavailable');
        return;
      }
      if (safety.failCloseMode === 'warn') {
        await appendPhase1NotificationAuditBestEffort({
          action: 'phase1.notifications.send.guard_warn',
          entityId: notificationId || 'legacy_phase1_notifications',
          traceId,
          requestId,
          payloadSummary: {
            reason: 'kill_switch_read_failed_fail_open',
            failCloseMode: safety.failCloseMode
          }
        });
      }
    }
    if (safety.killSwitchOn) {
      await appendPhase1NotificationAuditBestEffort({
        action: 'phase1.notifications.send.blocked',
        entityId: notificationId || 'legacy_phase1_notifications',
        traceId,
        requestId,
        payloadSummary: { reason: 'kill_switch_on' }
      });
      applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    const result = await sendNotificationPhase1({
      notificationId,
      sentAt: payload.sentAt,
      killSwitch: safety.killSwitchOn
    });
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.send',
      entityId: notificationId || 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: {
        ok: true,
        deliveredCount: Number.isFinite(Number(result.deliveredCount)) ? Number(result.deliveredCount) : null
      }
    });
    applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, deliveredCount: result.deliveredCount }));
  } catch (err) {
    if (isKillSwitchError(err)) {
      await appendPhase1NotificationAuditBestEffort({
        action: 'phase1.notifications.send.blocked',
        entityId: notificationId || 'legacy_phase1_notifications',
        traceId,
        requestId,
        payloadSummary: { reason: 'kill_switch_on' }
      });
      applyDeprecationHeaders(res, LEGACY_SUCCESSOR);
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('kill switch on');
      return;
    }
    await appendPhase1NotificationAuditBestEffort({
      action: 'phase1.notifications.send.error',
      entityId: notificationId || 'legacy_phase1_notifications',
      traceId,
      requestId,
      payloadSummary: {
        ok: false,
        error: err && err.message ? err.message : 'error'
      }
    });
    handleError(res, err);
  }
}

module.exports = {
  handleCreatePhase1,
  handleSendPhase1
};
