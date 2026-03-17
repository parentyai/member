'use strict';

const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

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
    ? attachOutcome(payload || {}, outcomeOptions)
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
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;
  const killSwitch = await getKillSwitch();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' });
    return;
  }

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : null;
  const opts = options && typeof options === 'object' ? options : {};
  const forcedStage = typeof opts.stage === 'string' ? opts.stage : null;
  const forcedMode = typeof opts.mode === 'string' ? opts.mode : null;
  const result = await runCityPackSourceAuditJob({
    runId: payload.runId,
    mode: forcedMode || payload.mode,
    stage: forcedStage || payload.stage,
    packClass: payload.packClass,
    targetSourceRefIds: payload.targetSourceRefIds,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_source_audit_job',
    requestId: payload.requestId || null
  });
  writeJson(res, 200, result);
}

module.exports = {
  handleCityPackSourceAuditJob,
  requireInternalJobToken
};
