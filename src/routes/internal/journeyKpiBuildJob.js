'use strict';

const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
const { getKillSwitch } = require('../../repos/firestore/systemFlagsRepo');
const { aggregateJourneyKpis } = require('../../usecases/journey/aggregateJourneyKpis');

function writeJson(res, status, payload) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
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
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;
  if (!resolveEnabled()) {
    writeJson(res, 503, { ok: false, error: 'journey_kpi_disabled' });
    return;
  }

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
    });
  } catch (err) {
    writeJson(res, 500, {
      ok: false,
      error: err && err.message ? String(err.message) : 'error',
      traceId
    });
  }
}

module.exports = {
  handleJourneyKpiBuildJob
};
