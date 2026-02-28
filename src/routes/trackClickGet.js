'use strict';

const { decodeTrackToken } = require('../domain/trackToken');
const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');
const auditLogUsecase = require('../usecases/audit/appendAuditLog');

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
  if (typeof headerId === 'string' && headerId.length > 0) return headerId;
  const trace = req && req.headers && req.headers['x-cloud-trace-context'];
  if (typeof trace === 'string' && trace.length > 0) return trace.split('/')[0];
  return 'unknown';
}

function resolveTraceId(req, fallbackRequestId) {
  const traceId = req && req.headers && req.headers['x-trace-id'];
  if (typeof traceId === 'string' && traceId.trim().length > 0) return traceId.trim();
  return fallbackRequestId || 'unknown';
}

function appendTrackClickAuditBestEffort(payload) {
  if (!isTrackClickAuditEnabled()) return;
  const data = payload && typeof payload === 'object' ? payload : {};
  Promise.resolve()
    .then(() => auditLogUsecase.appendAuditLog({
      actor: 'public_click',
      action: 'track.click.get',
      entityType: 'delivery',
      entityId: data.deliveryId || 'unknown',
      traceId: data.traceId || 'unknown',
      requestId: data.requestId || 'unknown',
      payloadSummary: {
        result: data.result || 'unknown',
        errorCode: data.errorCode || null,
        deliveryId: data.deliveryId || null,
        linkRegistryId: data.linkRegistryId || null
      }
    }))
    .catch(() => {});
}

async function handleTrackClickGet(req, res, token) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  const decoded = decodePathToken(token);
  if (!decoded) {
    writeError(res, 400, 'token required');
    appendTrackClickAuditBestEffort({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'token_required'
    });
    return;
  }

  let payload;
  try {
    payload = decodeTrackToken(decoded);
  } catch (err) {
    const msg = err && err.message ? err.message : 'invalid token';
    if (msg.includes('expired') || msg.includes('invalid')) {
      writeError(res, 403, 'forbidden');
      appendTrackClickAuditBestEffort({
        traceId,
        requestId,
        result: 'reject',
        errorCode: msg.includes('expired') ? 'token_expired' : 'token_invalid'
      });
      return;
    }
    writeError(res, 500, 'error');
    appendTrackClickAuditBestEffort({
      traceId,
      requestId,
      result: 'error',
      errorCode: 'decode_error'
    });
    return;
  }

  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    appendTrackClickAuditBestEffort({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      result: 'ok'
    });
    res.writeHead(302, { location: result.url });
    res.end();
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found') || message.includes('WARN')) {
      writeError(res, 400, message.includes('WARN') ? 'link health WARN' : message);
      appendTrackClickAuditBestEffort({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        result: 'reject',
        errorCode: message.includes('WARN') ? 'warn_link' : 'required_or_not_found'
      });
      return;
    }
    writeError(res, 500, 'error');
    appendTrackClickAuditBestEffort({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      result: 'error',
      errorCode: 'unexpected'
    });
  }
}

module.exports = {
  handleTrackClickGet
};
