'use strict';

const journeyBranchQueueRepo = require('../../repos/firestore/journeyBranchQueueRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

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

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const limit = parseLimit(req);
  const status = parseString(req, 'status');
  const lineUserId = parseString(req, 'lineUserId');

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

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    limit,
    status,
    lineUserId,
    summary: buildSummary(items),
    items
  }));
}

module.exports = {
  handleStatus
};
