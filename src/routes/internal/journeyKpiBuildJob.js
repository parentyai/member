'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { aggregateJourneyKpis } = require('../../usecases/journey/aggregateJourneyKpis');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_KEY = 'internal_journey_kpi_build_job';

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, Object.assign({
    routeType: 'internal_job',
    guard: { routeKey: ROUTE_KEY }
  }, outcomeOptions || {}));
  applyOutcomeHeaders(res, body.outcome);
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

function resolveEnabled() {
  const raw = process.env.ENABLE_JOURNEY_KPI;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

async function handleJourneyKpiBuildJob(req, res, bodyText) {
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
  if (!resolveEnabled()) {
    writeJson(res, 503, { ok: false, error: 'journey_kpi_disabled' }, {
      state: 'blocked',
      reason: 'journey_kpi_disabled',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
    return;
  }

  const killSwitch = await getKillSwitch();
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

  const traceId = req.headers && typeof req.headers['x-trace-id'] === 'string' && req.headers['x-trace-id'].trim()
    ? req.headers['x-trace-id'].trim()
    : (typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null);

  try {
    const result = await aggregateJourneyKpis({
      dateKey: payload.dateKey,
      lookbackDays: payload.lookbackDays,
      scanLimit: payload.scanLimit,
      nowMs: payload.nowMs,
      write: payload.dryRun !== true,
      actor: 'journey_kpi_job',
      traceId,
      requestId: payload.requestId || null
    });

    writeJson(res, 200, {
      ok: true,
      dryRun: payload.dryRun === true,
      traceId,
      result
    }, {
      state: 'success',
      reason: 'completed',
      guard: { routeKey: ROUTE_KEY, decision: 'allow' }
    });
  } catch (err) {
    writeJson(res, 500, {
      ok: false,
      error: err && err.message ? String(err.message) : 'error',
      traceId
    }, {
      state: 'error',
      reason: 'unhandled_error',
      guard: { routeKey: ROUTE_KEY, decision: 'block' }
    });
  }
}

module.exports = {
  handleJourneyKpiBuildJob
};
