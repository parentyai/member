'use strict';

const journeyKpiDailyRepo = require('../../repos/firestore/journeyKpiDailyRepo');
const { aggregateJourneyKpis } = require('../../usecases/journey/aggregateJourneyKpis');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_journey_kpi';

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, status, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function resolveEnabled() {
  const raw = process.env.ENABLE_JOURNEY_KPI;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function parseDateKey(value) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return null;
  return String(value);
}

async function handleJourneyKpi(req, res, deps) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!resolveEnabled()) {
    writeJson(res, 503, { ok: false, error: 'journey_kpi_disabled', traceId, requestId }, {
      state: 'blocked',
      reason: 'journey_kpi_disabled'
    });
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const dateKey = parseDateKey(url.searchParams.get('dateKey'));
    const refresh = url.searchParams.get('refresh') === '1';

    let kpi = null;
    let source = 'snapshot';

    if (dateKey) {
      kpi = await (deps && deps.journeyKpiDailyRepo ? deps.journeyKpiDailyRepo : journeyKpiDailyRepo)
        .getJourneyKpiDaily(dateKey);
    } else {
      kpi = await (deps && deps.journeyKpiDailyRepo ? deps.journeyKpiDailyRepo : journeyKpiDailyRepo)
        .getLatestJourneyKpiDaily();
    }

    if (!kpi || refresh) {
      source = 'computed';
      const aggregateFn = deps && deps.aggregateJourneyKpis ? deps.aggregateJourneyKpis : aggregateJourneyKpis;
      kpi = await aggregateFn({
        dateKey: dateKey || null,
        lookbackDays: 120,
        scanLimit: 4000,
        actor,
        traceId,
        requestId,
        write: true
      });
    }

    const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
    await auditFn({
      actor,
      action: 'journey_kpi.view',
      entityType: 'journey_kpi_daily',
      entityId: kpi && kpi.dateKey ? kpi.dateKey : 'latest',
      traceId,
      requestId,
      payloadSummary: {
        source,
        refresh,
        dateKey: kpi && kpi.dateKey ? kpi.dateKey : null,
        totalUsers: kpi && kpi.totalUsers ? kpi.totalUsers : 0
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      source,
      kpi
    }, { reason: 'completed' });
  } catch (err) {
    logRouteError('admin.os_journey_kpi', err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, { reason: 'error' });
  }
}

module.exports = {
  handleJourneyKpi
};
