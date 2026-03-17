'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { importMunicipalitySchools } = require('../../usecases/cityPack/importMunicipalitySchools');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

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
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;
  const killSwitch = await getKillSwitchFn();
  if (killSwitch) {
    writeJson(res, 409, { ok: false, error: 'kill switch on' }, { state: 'blocked', reason: 'kill_switch_on' });
    return;
  }
  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' }, { state: 'error', reason: 'invalid_json' });
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
    writeJson(res, status, { ok: false, error: message }, { state: 'error', reason });
  }
}

module.exports = {
  handleMunicipalitySchoolsImportJob
};
