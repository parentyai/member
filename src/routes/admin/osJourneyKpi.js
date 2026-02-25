'use strict';

const journeyKpiDailyRepo = require('../../repos/firestore/journeyKpiDailyRepo');
const { aggregateJourneyKpis } = require('../../usecases/journey/aggregateJourneyKpis');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

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

async function handleJourneyKpi(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  if (!resolveEnabled()) {
    res.writeHead(503, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'journey_kpi_disabled', traceId, requestId }));
    return;
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const dateKey = parseDateKey(url.searchParams.get('dateKey'));
    const refresh = url.searchParams.get('refresh') === '1';

    let kpi = null;
    let source = 'snapshot';

    if (dateKey) {
      kpi = await journeyKpiDailyRepo.getJourneyKpiDaily(dateKey);
    } else {
      kpi = await journeyKpiDailyRepo.getLatestJourneyKpiDaily();
    }

    if (!kpi || refresh) {
      source = 'computed';
      kpi = await aggregateJourneyKpis({
        dateKey: dateKey || null,
        lookbackDays: 120,
        scanLimit: 4000,
        actor,
        traceId,
        requestId,
        write: true
      });
    }

    await appendAuditLog({
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

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      source,
      kpi
    }));
  } catch (err) {
    logRouteError('admin.os_journey_kpi', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleJourneyKpi
};
