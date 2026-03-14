'use strict';

const { URL } = require('url');

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { queryLatestPatrolInsights } = require('../../usecases/qualityPatrol/queryLatestPatrolInsights');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parsePositiveInt(value, fallback, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, Math.min(max, Math.floor(numeric)));
}

function parseQueryParams(req) {
  const url = new URL(req.url || '/api/admin/quality-patrol', 'http://127.0.0.1');
  return {
    mode: url.searchParams.get('mode') || 'latest',
    audience: url.searchParams.get('audience') || 'operator',
    fromAt: url.searchParams.get('fromAt') || null,
    toAt: url.searchParams.get('toAt') || null,
    limit: parsePositiveInt(url.searchParams.get('limit'), 100, 500),
    traceLimit: parsePositiveInt(url.searchParams.get('traceLimit'), 50, 200),
    registryLimit: parsePositiveInt(url.searchParams.get('registryLimit'), 100, 200),
    backlogLimit: parsePositiveInt(url.searchParams.get('backlogLimit'), 50, 100)
  };
}

async function handleQualityPatrolQuery(req, res, deps) {
  if (req.method !== 'GET') {
    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'not found' }));
    return;
  }

  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const queryUsecase = deps && deps.queryLatestPatrolInsights ? deps.queryLatestPatrolInsights : queryLatestPatrolInsights;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;

  try {
    const result = await queryUsecase(parseQueryParams(req), deps);
    try {
      await auditFn({
        actor,
        action: 'quality_patrol.query.view',
        entityType: 'quality_patrol_query',
        entityId: result && result.mode ? result.mode : 'latest',
        traceId,
        requestId,
        payloadSummary: {
          audience: result && result.audience ? result.audience : 'operator',
          overallStatus: result && result.summary ? result.summary.overallStatus : null,
          topPriorityCount: result && result.summary ? result.summary.topPriorityCount : 0,
          observationBlockerCount: result && result.summary ? result.summary.observationBlockerCount : 0
        }
      });
    } catch (auditErr) {
      logRouteError('admin.quality_patrol.audit', auditErr, { actor, traceId, requestId });
    }

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Object.assign({
      ok: true,
      traceId,
      requestId
    }, result)));
  } catch (err) {
    logRouteError('admin.quality_patrol.query', err, { actor, traceId, requestId });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleQualityPatrolQuery
};
