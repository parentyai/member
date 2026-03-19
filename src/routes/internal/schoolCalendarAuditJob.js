'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const schoolCalendarLinksRepo = require('../../repos/firestore/schoolCalendarLinksRepo');
const { runCityPackSourceAuditJob } = require('../../usecases/cityPack/runCityPackSourceAuditJob');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_school_calendar_audit_job';

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

async function handleSchoolCalendarAuditJob(req, res, bodyText, deps) {
  const getKillSwitchFn = deps && typeof deps.getKillSwitchFn === 'function' ? deps.getKillSwitchFn : getKillSwitch;
  const listSchoolCalendarLinksFn = deps && typeof deps.listSchoolCalendarLinksFn === 'function'
    ? deps.listSchoolCalendarLinksFn
    : schoolCalendarLinksRepo.listSchoolCalendarLinks;
  const runCityPackSourceAuditJobFn = deps && typeof deps.runCityPackSourceAuditJobFn === 'function'
    ? deps.runCityPackSourceAuditJobFn
    : runCityPackSourceAuditJob;
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

  const links = await listSchoolCalendarLinksFn({
    limit: Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : 500,
    regionKey: payload.regionKey || undefined,
    schoolYear: payload.schoolYear || undefined,
    status: 'active'
  });
  const targetSourceRefIds = Array.from(new Set(
    links
      .map((item) => (item && typeof item.sourceRefId === 'string' ? item.sourceRefId.trim() : ''))
      .filter(Boolean)
  ));

  const traceIdHeader = req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : null;
  const result = await runCityPackSourceAuditJobFn({
    runId: payload.runId,
    mode: payload.mode,
    stage: payload.stage || 'heavy',
    packClass: payload.packClass || null,
    targetSourceRefIds,
    traceId: traceIdHeader || payload.traceId || null,
    actor: 'city_pack_school_calendar_audit_job',
    requestId: payload.requestId || null
  });
  const response = Object.assign({}, result, {
    targetSourceRefIds,
    targetCount: targetSourceRefIds.length
  });
  let outcome = { state: 'success', reason: 'completed' };
  if (targetSourceRefIds.length === 0) {
    outcome = { state: 'success', reason: 'no_targets' };
  } else if (Number(result && result.failed) > 0 && Number(result && result.succeeded) > 0) {
    outcome = { state: 'partial', reason: 'completed_with_failures' };
  } else if (Number(result && result.failed) > 0) {
    outcome = { state: 'error', reason: 'completed_with_failures' };
  }
  writeJson(res, 200, response, Object.assign({}, outcome, {
    guard: { routeKey: ROUTE_KEY, decision: 'allow' }
  }));
}

module.exports = {
  handleSchoolCalendarAuditJob
};
