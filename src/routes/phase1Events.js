'use strict';

const crypto = require('crypto');
const { logEventBestEffort } = require('../usecases/events/logEvent');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');
const ROUTE_KEY = 'phase1_events';

function isLegacyRouteFreezeEnabled() {
  const raw = process.env.LEGACY_ROUTE_FREEZE_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return false; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim()) return headerId.trim();
  const cloudTrace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof cloudTrace === 'string' && cloudTrace.trim()) return cloudTrace.split('/')[0];
  return `phase1_events_${crypto.randomUUID()}`;
}

function resolveTraceId(req, fallbackRequestId) {
  const traceId = req && req.headers && req.headers['x-trace-id'];
  if (typeof traceId === 'string' && traceId.trim()) return traceId.trim();
  return fallbackRequestId;
}

async function appendPhase1EventAuditBestEffort(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  try {
    await appendAuditLog({
      actor: 'phase1_events_route',
      action: data.action || 'phase1.events.log',
      entityType: 'event',
      entityId: data.entityId || 'unknown',
      traceId: data.traceId || null,
      requestId: data.requestId || null,
      payloadSummary: {
        result: data.result || 'unknown',
        errorCode: data.errorCode || null,
        type: data.type || null,
        lineUserId: data.lineUserId || null,
        notificationId: data.notificationId || null,
        failCloseMode: data.failCloseMode || null,
        guardRoute: ROUTE_KEY
      }
    });
  } catch (_err) {
    // best effort only
  }
}

async function handlePhase1Event(req, res, body) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  if (isLegacyRouteFreezeEnabled()) {
    await appendPhase1EventAuditBestEffort({
      action: 'phase1.events.blocked',
      result: 'reject',
      errorCode: 'legacy_route_frozen',
      traceId,
      requestId
    });
    res.writeHead(410, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'legacy route frozen' }));
    return;
  }
  const payload = parseJson(body, res);
  if (!payload) {
    await appendPhase1EventAuditBestEffort({
      action: 'phase1.events.reject',
      result: 'reject',
      errorCode: 'invalid_json',
      traceId,
      requestId
    });
    return;
  }

  const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
  if (safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      await appendPhase1EventAuditBestEffort({
        action: 'phase1.events.blocked',
        result: 'reject',
        errorCode: 'kill_switch_read_failed_fail_closed',
        traceId,
        requestId,
        type: payload.type,
        lineUserId: payload.lineUserId,
        notificationId: payload.ref && payload.ref.notificationId,
        failCloseMode: safety.failCloseMode
      });
      res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'temporarily unavailable' }));
      return;
    }
    if (safety.failCloseMode === 'warn') {
      await appendPhase1EventAuditBestEffort({
        action: 'phase1.events.guard_warn',
        result: 'warn',
        errorCode: 'kill_switch_read_failed_fail_open',
        traceId,
        requestId,
        type: payload.type,
        lineUserId: payload.lineUserId,
        notificationId: payload.ref && payload.ref.notificationId,
        failCloseMode: safety.failCloseMode
      });
    }
  }

  if (safety.killSwitchOn) {
    await appendPhase1EventAuditBestEffort({
      action: 'phase1.events.blocked',
      result: 'reject',
      errorCode: 'kill_switch_on',
      traceId,
      requestId,
      type: payload.type,
      lineUserId: payload.lineUserId,
      notificationId: payload.ref && payload.ref.notificationId
    });
    res.writeHead(403, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'kill switch on' }));
    return;
  }
  const result = await logEventBestEffort({
    lineUserId: payload.lineUserId,
    type: payload.type,
    ref: payload.ref
  });
  if (!result.ok) {
    await appendPhase1EventAuditBestEffort({
      action: 'phase1.events.reject',
      result: 'reject',
      errorCode: result.error,
      traceId,
      requestId,
      type: payload.type,
      lineUserId: payload.lineUserId,
      notificationId: payload.ref && payload.ref.notificationId
    });
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: result.error }));
    return;
  }
  await appendPhase1EventAuditBestEffort({
    action: 'phase1.events.log',
    entityId: result.id,
    result: 'ok',
    traceId,
    requestId,
    type: payload.type,
    lineUserId: payload.lineUserId,
    notificationId: payload.ref && payload.ref.notificationId
  });
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: true, id: result.id }));
}

module.exports = {
  handlePhase1Event
};
