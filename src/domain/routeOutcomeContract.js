'use strict';

const VALID_STATES = new Set(['success', 'degraded', 'partial', 'error', 'blocked']);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveState(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (VALID_STATES.has(normalized)) return normalized;
  return fallback;
}

function resolveRouteType(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return 'unknown';
  return normalized;
}

function inferOutcomeState(payload, options) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const opts = options && typeof options === 'object' ? options : {};
  if (resolveState(opts.state, '')) return resolveState(opts.state, 'error');
  if (row.partialFailure === true || row.partial === true) return 'partial';
  if (row.ok === false) return 'error';
  if (row.degraded === true) return 'degraded';
  if (opts.degraded === true) return 'degraded';
  return 'success';
}

function buildOutcome(payload, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = opts.guard && typeof opts.guard === 'object' ? opts.guard : null;
  const outcome = {
    state: inferOutcomeState(payload, opts),
    reason: normalizeText(opts.reason) || null,
    routeType: resolveRouteType(opts.routeType)
  };
  if (guard) {
    outcome.guard = {
      routeKey: normalizeText(guard.routeKey) || null,
      failCloseMode: normalizeText(guard.failCloseMode) || null,
      readError: guard.readError === true,
      killSwitchOn: guard.killSwitchOn === true,
      decision: normalizeText(guard.decision) || null
    };
  }
  return outcome;
}

function attachOutcome(payload, options) {
  const row = payload && typeof payload === 'object' ? payload : {};
  const result = Object.assign({}, row);
  if (result.outcome && typeof result.outcome === 'object') return result;
  result.outcome = buildOutcome(row, options);
  return result;
}

function applyOutcomeHeaders(res, outcome) {
  if (!res || typeof res.setHeader !== 'function') return;
  const row = outcome && typeof outcome === 'object' ? outcome : {};
  const state = normalizeText(row.state) || 'unknown';
  const reason = normalizeText(row.reason) || null;
  const routeType = normalizeText(row.routeType) || 'unknown';
  res.setHeader('x-member-outcome-state', state);
  res.setHeader('x-member-outcome-route-type', routeType);
  if (reason) res.setHeader('x-member-outcome-reason', reason);
}

module.exports = {
  attachOutcome,
  applyOutcomeHeaders,
  buildOutcome,
  inferOutcomeState
};
