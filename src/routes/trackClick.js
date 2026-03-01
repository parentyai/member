'use strict';

const crypto = require('crypto');
const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');
const auditLogUsecase = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');
const ROUTE_KEY = 'track_click_post';

function isTrackPostClickEnabled() {
  const raw = process.env.TRACK_POST_CLICK_ENABLED;
  if (raw === undefined || raw === null || String(raw).trim() === '') return true; // compat default
  const v = String(raw).trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes' || v === 'on';
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
  return `track_click_post_${crypto.randomUUID()}`;
}

function resolveTraceId(req, fallbackRequestId) {
  const traceId = req && req.headers && req.headers['x-trace-id'];
  if (typeof traceId === 'string' && traceId.trim().length > 0) return traceId.trim();
  return fallbackRequestId || 'unknown';
}

function logObs(action, result, fields) {
  const parts = [`[OBS] action=${action} result=${result}`];
  if (fields && fields.requestId) parts.push(`requestId=${fields.requestId}`);
  if (fields && fields.deliveryId) parts.push(`deliveryId=${fields.deliveryId}`);
  if (fields && fields.linkRegistryId) parts.push(`linkRegistryId=${fields.linkRegistryId}`);
  console.log(parts.join(' '));
}

function logTrackAuditEnqueueFailure(payload, err) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const message = err && err.message ? String(err.message) : 'unknown_error';
  const parts = [
    '[OBS] action=track_audit_enqueue',
    'result=error',
    `route=${ROUTE_KEY}`,
    `auditAction=${String(data.action || 'track.click.post')}`,
    `requestId=${String(data.requestId || 'unknown')}`,
    `traceId=${String(data.traceId || 'unknown')}`,
    `error=${message}`
  ];
  if (data.deliveryId) parts.push(`deliveryId=${String(data.deliveryId)}`);
  if (data.linkRegistryId) parts.push(`linkRegistryId=${String(data.linkRegistryId)}`);
  console.warn(parts.join(' '));
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

async function appendTrackClickAuditWithPolicy(payload, options) {
  if (!isTrackClickAuditEnabled()) return;
  const data = payload && typeof payload === 'object' ? payload : {};
  const modeRaw = options && typeof options.auditWriteMode === 'string' ? options.auditWriteMode.trim().toLowerCase() : '';
  const auditWriteMode = modeRaw === 'await' ? 'await' : 'best_effort';
  const writeAudit = () => auditLogUsecase.appendAuditLog({
      actor: 'public_click',
      action: data.action || 'track.click.post',
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

async function handleTrackClick(req, res, body) {
  const requestId = resolveRequestId(req);
  const traceId = resolveTraceId(req, requestId);
  const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
  const auditWriteMode = safety.trackAuditWriteMode;

  if (safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('temporarily unavailable');
      logObs('click_post_compat', 'reject', { requestId });
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
        action: 'track.click.post.guard_warn'
      }, { auditWriteMode });
    }
  }

  if (safety.killSwitchOn) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    logObs('click_post_compat', 'reject', { requestId });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'kill_switch_on'
    }, { auditWriteMode });
    return;
  }

  if (!isTrackPostClickEnabled()) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('forbidden');
    logObs('click_post_compat', 'reject', { requestId });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'post_disabled'
    }, { auditWriteMode });
    return;
  }

  const payload = parseJson(body, res);
  if (!payload) {
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'invalid_json'
    }, { auditWriteMode });
    return;
  }
  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      at: payload.at
    });
    logObs('click', 'ok', {
      requestId,
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
    if (message.includes('required') || message.includes('not found')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end(message);
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId
      });
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        result: 'reject',
        errorCode: 'required_or_not_found'
      }, { auditWriteMode });
      return;
    }
    if (message.includes('WARN')) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('link health WARN');
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId
      });
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        result: 'reject',
        errorCode: 'warn_link'
      }, { auditWriteMode });
      return;
    }
    logObs('click', 'error', {
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId
    });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      result: 'error',
      errorCode: 'unexpected'
    }, { auditWriteMode });
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('error');
  }
}

module.exports = {
  handleTrackClick
};
