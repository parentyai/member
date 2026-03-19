'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { importMunicipalitySchools } = require('../../usecases/cityPack/importMunicipalitySchools');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_municipality_schools_import_job';

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

function resolveOutcome(result) {
  if (!result || typeof result !== 'object') return { state: 'error', reason: 'import_failed' };
  if (Number(result.failed) > 0 && Number(result.succeeded) > 0) return { state: 'partial', reason: 'completed_with_failures' };
  if (Number(result.failed) > 0) return { state: 'error', reason: 'completed_with_failures' };
  if (result.dryRun === true) return { state: 'success', reason: 'dry_run' };
  return { state: 'success', reason: 'completed' };
}

async function handleMunicipalitySchoolsImportJob(req, res, bodyText, deps) {
  const getKillSwitchFn = deps && typeof deps.getKillSwitchFn === 'function' ? deps.getKillSwitchFn : getKillSwitch;
  const importMunicipalitySchoolsFn = deps && typeof deps.importMunicipalitySchoolsFn === 'function'
    ? deps.importMunicipalitySchoolsFn
    : importMunicipalitySchools;
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

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  try {
    const result = await importMunicipalitySchoolsFn({
      rows: payload.rows,
      dryRun: payload.dryRun === true,
      regionKey: payload.regionKey,
      traceId: traceIdHeader || payload.traceId || null,
      requestId: payload.requestId || null,
      actor: 'city_pack_municipality_schools_import_job'
    });
    writeJson(res, 200, result, resolveOutcome(result));
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'import failed';
    const reason = message === 'rows required' ? 'rows_required' : 'import_failed';
    const status = message === 'rows required' ? 400 : 500;
    writeJson(res, status, { ok: false, error: message }, {
      state: 'error',
      reason,
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
  }
}

module.exports = {
  handleMunicipalitySchoolsImportJob
};
