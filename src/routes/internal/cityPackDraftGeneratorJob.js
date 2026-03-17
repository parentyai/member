'use strict';

const { runCityPackDraftJob } = require('../../usecases/cityPack/runCityPackDraftJob');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
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
  if (!result || typeof result !== 'object') return { state: 'error', reason: 'draft_job_failed' };
  if (result.ok === true && result.idempotent) return { state: 'success', reason: 'already_drafted' };
  if (result.ok === true) return { state: 'success', reason: 'completed' };
  if (result.reason === 'source_candidates_missing') return { state: 'blocked', reason: 'source_candidates_missing' };
  if (result.reason === 'source_candidates_invalid') return { state: 'blocked', reason: 'source_candidates_invalid' };
  if (result.reason === 'request_not_found') return { state: 'error', reason: 'request_not_found' };
  return { state: 'error', reason: typeof result.reason === 'string' && result.reason.trim() ? result.reason.trim() : 'draft_job_failed' };
}

async function handleCityPackDraftGeneratorJob(req, res, bodyText, deps) {
  const getKillSwitchFn = deps && typeof deps.getKillSwitchFn === 'function' ? deps.getKillSwitchFn : getKillSwitch;
  const runCityPackDraftJobFn = deps && typeof deps.runCityPackDraftJobFn === 'function'
    ? deps.runCityPackDraftJobFn
    : runCityPackDraftJob;
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

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string' ? req.headers['x-trace-id'].trim() : null;
  const result = await runCityPackDraftJobFn({
    requestId: payload.requestId,
    runId: payload.runId,
    sourceUrls: payload.sourceUrls,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_draft_job'
  });
  writeJson(res, 200, result, resolveOutcome(result));
}

module.exports = {
  handleCityPackDraftGeneratorJob
};
