'use strict';

const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_city_pack_source_audit_job';

function mergeOutcomeOptions(base, override) {
  const left = base && typeof base === 'object' ? base : null;
  const right = override && typeof override === 'object' ? override : null;
  if (!left && !right) return null;
  const merged = Object.assign({}, left || {}, right || {});
  const baseGuard = left && left.guard && typeof left.guard === 'object' ? left.guard : null;
  const overrideGuard = right && right.guard && typeof right.guard === 'object' ? right.guard : null;
  if (baseGuard || overrideGuard) {
    merged.guard = Object.assign({}, baseGuard || {}, overrideGuard || {});
  }
  return merged;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = outcomeOptions && typeof outcomeOptions === 'object'
    ? attachOutcome(payload || {}, mergeOutcomeOptions({
      routeType: 'internal_job',
      guard: { routeKey: ROUTE_KEY }
    }, outcomeOptions))
    : payload;
  if (body && body.outcome) applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function parseJson(bodyText) {
  try {
    return JSON.parse(bodyText || '{}');
  } catch (_err) {
    return null;
  }
}

function resolveInternalToken(req) {
  const header = req && req.headers ? req.headers['x-city-pack-job-token'] : null;
  if (typeof header === 'string' && header.trim()) return header.trim();
  const auth = req && req.headers ? req.headers.authorization : null;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice('Bearer '.length).trim();
  return '';
}

function requireInternalJobToken(req, res, outcomeOptions) {
  const expected = process.env.CITY_PACK_JOB_TOKEN || '';
  if (!expected) {
    writeJson(res, 503, { ok: false, error: 'CITY_PACK_JOB_TOKEN not configured' }, mergeOutcomeOptions(outcomeOptions, {
      state: 'error',
      reason: 'job_token_not_configured',
      guard: { decision: 'block' }
    }));
    return false;
  }
  const actual = resolveInternalToken(req);
  if (!actual || actual !== expected) {
    writeJson(res, 401, { ok: false, error: 'unauthorized' }, mergeOutcomeOptions(outcomeOptions, {
      state: 'blocked',
      reason: 'unauthorized',
      guard: { decision: 'block' }
    }));
    return false;
  }
  return true;
}

async function handleCityPackSourceAuditJob(req, res, bodyText, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const runCityPackSourceAuditJobFn = opts.runCityPackSourceAuditJobFn || runCityPackSourceAuditJob;
  const getKillSwitchFn = opts.getKillSwitchFn || getKillSwitch;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' }, {
      state: 'error',
      reason: 'not_found',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }
  if (!requireInternalJobToken(req, res, {
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  })) return;
  const killSwitch = await getKillSwitchFn();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' }, {
      state: 'blocked',
      reason: 'kill_switch_on',
      guard: { routeKey: ROUTE_KEY, decision: 'block', killSwitchOn: true }
    });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, {
      state: 'error',
      reason: 'invalid_json',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : null;
  const forcedStage = typeof opts.stage === 'string' ? opts.stage : null;
  const forcedMode = typeof opts.mode === 'string' ? opts.mode : null;
  const result = await runCityPackSourceAuditJobFn({
    runId: payload.runId,
    mode: forcedMode || payload.mode,
    stage: forcedStage || payload.stage,
    packClass: payload.packClass,
    targetSourceRefIds: payload.targetSourceRefIds,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_source_audit_job',
    requestId: payload.requestId || null
  });
  let outcome = { state: 'success', reason: 'completed' };
  if (Number(result && result.processed) === 0) {
    outcome = { state: 'success', reason: 'no_targets' };
  } else if (Number(result && result.failed) > 0 && Number(result && result.succeeded) > 0) {
    outcome = { state: 'partial', reason: 'completed_with_failures' };
  } else if (Number(result && result.failed) > 0) {
    outcome = { state: 'error', reason: 'completed_with_failures' };
  }
  writeJson(res, 200, result, Object.assign({}, outcome, {
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  }));
}

module.exports = {
  handleCityPackSourceAuditJob,
  requireInternalJobToken
};
