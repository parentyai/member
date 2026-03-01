'use strict';

const crypto = require('crypto');
const { decodeTrackToken } = require('../domain/trackToken');
const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');
const auditLogUsecase = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');
const ROUTE_KEY = 'track_click_get';

function decodePathToken(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return null;
  const value = raw.trim();
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch (_err) {
    return null;
  }
}

function writeError(res, status, body) {
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function isTrackClickAuditEnabled() {
  const raw = process.env.TRACK_CLICK_AUDIT_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return true; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
}

function resolveRequestId(req) {
  const headerId = req && req.headers && req.headers['x-request-id'];
  if (typeof headerId === 'string' && headerId.trim().length > 0) return headerId.trim();
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.trim().length > 0) return trace.split('/')[0];
  return `track_click_get_${crypto.randomUUID()}`;
}

function resolveTraceId(req, fallbackRequestId) {
  const traceId = req && req.headers && req.headers['x-trace-id'];
  if (typeof traceId === 'string' && traceId.trim().length > 0) return traceId.trim();
  return fallbackRequestId || 'unknown';
}

function logTrackAuditEnqueueFailure(payload, err) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const message = err && err.message ? String(err.message) : 'unknown_error';
  const parts = [
    '[OBS] action=track_audit_enqueue',
    'result=error',
    `route=${ROUTE_KEY}`,
    `auditAction=${String(data.action || 'track.click.get')}`,
    `requestId=${String(data.requestId || 'unknown')}`,
    `traceId=${String(data.traceId || 'unknown')}`,
    `error=${message}`
  ];
  if (data.deliveryId) parts.push(`deliveryId=${String(data.deliveryId)}`);
  if (data.linkRegistryId) parts.push(`linkRegistryId=${String(data.linkRegistryId)}`);
  console.warn(parts.join(' '));
}

async function appendTrackClickAuditWithPolicy(payload, options) {
  if (!isTrackClickAuditEnabled()) return;
  const data = payload && typeof payload === 'object' ? payload : {};
  const modeRaw = options && typeof options.auditWriteMode === 'string' ? options.auditWriteMode.trim().toLowerCase() : '';
  const auditWriteMode = modeRaw === 'await' ? 'await' : 'best_effort';
  const writeAudit = () => auditLogUsecase.appendAuditLog({
      actor: 'public_click',
      action: data.action || 'track.click.get',
      entityType: 'delivery',
      entityId: data.deliveryId || 'unknown',
      traceId: data.traceId || 'unknown',
      requestId: data.requestId || 'unknown',
      payloadSummary: {
        result: data.result || 'unknown',
        errorCode: data.errorCode || null,
        deliveryId: data.deliveryId || null,
        linkRegistryId: data.linkRegistryId || null,
        failCloseMode: data.failCloseMode || null,
        auditWriteMode,
        guardRoute: ROUTE_KEY
      }
    });
  if (auditWriteMode === 'await') {
    try {
      await writeAudit();
    } catch (err) {
      logTrackAuditEnqueueFailure(data, err);
    }
    return;
  }
  Promise.resolve()
    .then(writeAudit)
    .catch((err) => {
      logTrackAuditEnqueueFailure(data, err);
    });
}

async function handleTrackClickGet(req, res, token) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
  const auditWriteMode = safety.trackAuditWriteMode;
  if (safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      writeError(res, 503, 'temporarily unavailable');
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        result: 'reject',
        errorCode: 'kill_switch_read_failed_fail_closed',
        failCloseMode: safety.failCloseMode
      }, { auditWriteMode });
      return;
    }
    if (safety.failCloseMode === 'warn') {
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        result: 'warn',
        errorCode: 'kill_switch_read_failed_fail_open',
        failCloseMode: safety.failCloseMode,
        action: 'track.click.get.guard_warn'
      }, { auditWriteMode });
    }
  }
  if (safety.killSwitchOn) {
    writeError(res, 403, 'forbidden');
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'kill_switch_on'
    }, { auditWriteMode });
    return;
  }

  const decoded = decodePathToken(token);
  if (!decoded) {
    writeError(res, 400, 'token required');
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'token_required'
    }, { auditWriteMode });
    return;
  }

  let payload;
  try {
    payload = decodeTrackToken(decoded);
  } catch (err) {
    const msg = err && err.message ? err.message : 'invalid token';
    if (msg.includes('expired') || msg.includes('invalid')) {
      writeError(res, 403, 'forbidden');
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        result: 'reject',
        errorCode: msg.includes('expired') ? 'token_expired' : 'token_invalid'
      }, { auditWriteMode });
      return;
    }
    writeError(res, 500, 'error');
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'error',
      errorCode: 'decode_error'
    }, { auditWriteMode });
    return;
  }

  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      result: 'ok'
    }, { auditWriteMode });
    res.writeHead(302, { location: result.url });
    res.end();
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found') || message.includes('WARN')) {
      writeError(res, 400, message.includes('WARN') ? 'link health WARN' : message);
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        result: 'reject',
        errorCode: message.includes('WARN') ? 'warn_link' : 'required_or_not_found'
      }, { auditWriteMode });
      return;
    }
    writeError(res, 500, 'error');
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      result: 'error',
      errorCode: 'unexpected'
    }, { auditWriteMode });
  }
}

module.exports = {
  handleTrackClickGet
};
