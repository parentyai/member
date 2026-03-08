'use strict';

const crypto = require('crypto');
const { recordClickAndRedirect } = require('../usecases/track/recordClickAndRedirect');
const auditLogUsecase = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');
const { buildOutcome, applyOutcomeHeaders } = require('../domain/routeOutcomeContract');
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
  if (fields && fields.ctaSlot) parts.push(`ctaSlot=${fields.ctaSlot}`);
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
  if (data.ctaSlot) parts.push(`ctaSlot=${String(data.ctaSlot)}`);
  console.warn(parts.join(' '));
}

function parseJson(body, res, context) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    applyOutcomeHeaders(res, buildOutcome({ ok: false }, Object.assign({
      state: 'error',
      reason: 'invalid_json',
      routeType: 'public_write',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    }, context || {})));
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('invalid json');
    return null;
  }
}

function writeText(res, status, body, context) {
  applyOutcomeHeaders(res, buildOutcome({ ok: status < 400 }, Object.assign({
    routeType: 'public_write',
    guard: { routeKey: ROUTE_KEY }
  }, context || {})));
  res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8' });
  res.end(body);
}

function writeRedirect(res, location, context) {
  applyOutcomeHeaders(res, buildOutcome({ ok: true }, Object.assign({
    state: 'success',
    reason: 'ok',
    routeType: 'public_write',
    guard: { routeKey: ROUTE_KEY }
  }, context || {})));
  res.writeHead(302, { location });
  res.end();
}

async function appendTrackClickAuditWithPolicy(payload, options) {
  if (!isTrackClickAuditEnabled()) return;
  const data = payload && typeof payload === 'object' ? payload : {};
  const nonBlocking = Boolean(options && options.nonBlocking === true);
  const modeRaw = options && typeof options.auditWriteMode === 'string' ? options.auditWriteMode.trim().toLowerCase() : '';
  const auditWriteMode = nonBlocking ? 'best_effort' : (modeRaw === 'await' ? 'await' : 'best_effort');
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
        outcomeState: data.outcomeState || null,
        outcomeReason: data.outcomeReason || null,
        guardDecision: data.guardDecision || null,
        deliveryId: data.deliveryId || null,
        linkRegistryId: data.linkRegistryId || null,
        ctaSlot: data.ctaSlot || null,
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
  const guardDecision = safety.readError && safety.failCloseMode === 'warn' ? 'warn' : 'allow';
  const guardContext = {
    guard: {
      routeKey: ROUTE_KEY,
      failCloseMode: safety.failCloseMode || null,
      readError: safety.readError === true,
      killSwitchOn: safety.killSwitchOn === true,
      decision: guardDecision
    }
  };

  if (safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      writeText(res, 503, 'temporarily unavailable', Object.assign({
        state: 'blocked',
        reason: 'kill_switch_read_failed_fail_closed',
        guard: Object.assign({}, guardContext.guard, { decision: 'block' })
      }, guardContext));
      logObs('click_post_compat', 'reject', { requestId });
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        result: 'reject',
        errorCode: 'kill_switch_read_failed_fail_closed',
        failCloseMode: safety.failCloseMode,
        outcomeState: 'blocked',
        outcomeReason: 'kill_switch_read_failed_fail_closed',
        guardDecision: 'block'
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
        action: 'track.click.post.guard_warn',
        outcomeState: 'degraded',
        outcomeReason: 'kill_switch_read_failed_fail_open',
        guardDecision: 'warn'
      }, { auditWriteMode });
    }
  }

  if (safety.killSwitchOn) {
    writeText(res, 403, 'forbidden', Object.assign({
      state: 'blocked',
      reason: 'kill_switch_on',
      guard: Object.assign({}, guardContext.guard, { decision: 'block', killSwitchOn: true })
    }, guardContext));
    logObs('click_post_compat', 'reject', { requestId });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'kill_switch_on',
      outcomeState: 'blocked',
      outcomeReason: 'kill_switch_on',
      guardDecision: 'block'
    }, { auditWriteMode });
    return;
  }

  if (!isTrackPostClickEnabled()) {
    writeText(res, 403, 'forbidden', Object.assign({
      state: 'blocked',
      reason: 'post_disabled'
    }, guardContext));
    logObs('click_post_compat', 'reject', { requestId });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'post_disabled',
      outcomeState: 'blocked',
      outcomeReason: 'post_disabled',
      guardDecision
    }, { auditWriteMode });
    return;
  }

  const payload = parseJson(body, res, Object.assign({
    reason: 'invalid_json',
    guard: Object.assign({}, guardContext.guard, { decision: 'block' })
  }, guardContext));
  if (!payload) {
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      result: 'reject',
      errorCode: 'invalid_json',
      outcomeState: 'error',
      outcomeReason: 'invalid_json',
      guardDecision: 'block'
    }, { auditWriteMode });
    return;
  }
  try {
    const result = await recordClickAndRedirect({
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      ctaSlot: payload.ctaSlot,
      at: payload.at
    });
    logObs('click', 'ok', {
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      ctaSlot: payload.ctaSlot
    });
    appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      ctaSlot: payload.ctaSlot || null,
      result: 'ok',
      outcomeState: guardDecision === 'warn' ? 'degraded' : 'success',
      outcomeReason: guardDecision === 'warn' ? 'kill_switch_read_failed_fail_open' : 'ok',
      guardDecision
    }, { auditWriteMode, nonBlocking: true });
    writeRedirect(res, result.url, Object.assign({
      state: guardDecision === 'warn' ? 'degraded' : 'success',
      reason: guardDecision === 'warn' ? 'kill_switch_read_failed_fail_open' : 'ok'
    }, guardContext));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.includes('required') || message.includes('not found')) {
      writeText(res, 400, message, Object.assign({
        state: 'error',
        reason: 'required_or_not_found'
      }, guardContext));
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        ctaSlot: payload.ctaSlot
      });
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        ctaSlot: payload.ctaSlot || null,
        result: 'reject',
        errorCode: 'required_or_not_found',
        outcomeState: 'error',
        outcomeReason: 'required_or_not_found',
        guardDecision
      }, { auditWriteMode });
      return;
    }
    if (message.includes('WARN')) {
      writeText(res, 400, 'link health WARN', Object.assign({
        state: 'error',
        reason: 'warn_link'
      }, guardContext));
      logObs('click', 'reject', {
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        ctaSlot: payload.ctaSlot
      });
      await appendTrackClickAuditWithPolicy({
        traceId,
        requestId,
        deliveryId: payload.deliveryId,
        linkRegistryId: payload.linkRegistryId,
        ctaSlot: payload.ctaSlot || null,
        result: 'reject',
        errorCode: 'warn_link',
        outcomeState: 'error',
        outcomeReason: 'warn_link',
        guardDecision
      }, { auditWriteMode });
      return;
    }
    logObs('click', 'error', {
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      ctaSlot: payload.ctaSlot
    });
    await appendTrackClickAuditWithPolicy({
      traceId,
      requestId,
      deliveryId: payload.deliveryId,
      linkRegistryId: payload.linkRegistryId,
      ctaSlot: payload.ctaSlot || null,
      result: 'error',
      errorCode: 'unexpected',
      outcomeState: 'error',
      outcomeReason: 'unexpected',
      guardDecision
    }, { auditWriteMode });
    writeText(res, 500, 'error', Object.assign({
      state: 'error',
      reason: 'unexpected'
    }, guardContext));
  }
}

module.exports = {
  handleTrackClick
};
