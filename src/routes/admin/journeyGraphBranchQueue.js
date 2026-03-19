'use strict';

const journeyBranchQueueRepo = require('../../repos/firestore/journeyBranchQueueRepo');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.journey_graph_branch_queue_status';

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit') || 100);
  if (!Number.isFinite(raw) || raw < 1) return 100;
  return Math.min(Math.floor(raw), 500);
}

function parseString(req, key) {
  const url = new URL(req.url, 'http://localhost');
  const value = url.searchParams.get(key);
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function buildSummary(items) {
  const summary = {
    total: 0,
    pending: 0,
    sent: 0,
    failed: 0,
    skipped: 0
  };
  (Array.isArray(items) ? items : []).forEach((item) => {
    summary.total += 1;
    const status = typeof item.status === 'string' ? item.status.trim().toLowerCase() : '';
    if (status && Object.prototype.hasOwnProperty.call(summary, status)) summary[status] += 1;
  });
  return summary;
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const status = parseString(req, 'status');
  const lineUserId = parseString(req, 'lineUserId');

  try {
    const items = await journeyBranchQueueRepo.listJourneyBranchItems({
      status,
      lineUserId,
      limit
    }).catch(() => []);

    await appendAuditLog({
      actor,
      action: 'journey_graph.branch_queue.view',
      entityType: 'journey_branch_queue',
      entityId: lineUserId || status || 'all',
      traceId,
      requestId,
      payloadSummary: {
        limit,
        status,
        lineUserId,
        count: items.length
      }
    });

    writeJson(res, 200, {
      ok: true,
      traceId,
      requestId,
      limit,
      status,
      lineUserId,
      summary: buildSummary(items),
      items
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError(ROUTE_KEY, err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleStatus
};
