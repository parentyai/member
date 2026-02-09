'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function resolveLimit(value) {
  if (value === undefined || value === null) return 50;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

async function getTraceBundle(params, deps) {
  const payload = params || {};
  const traceId = requireString(payload.traceId, 'traceId');
  const limit = resolveLimit(payload.limit);

  const auditsRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const decisionsRepo = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const timelineRepo = deps && deps.decisionTimelineRepo ? deps.decisionTimelineRepo : decisionTimelineRepo;

  const [audits, decisions, timeline] = await Promise.all([
    auditsRepo.listAuditLogsByTraceId(traceId, limit),
    decisionsRepo.listDecisionsByTraceId(traceId, limit),
    timelineRepo.listTimelineEntriesByTraceId(traceId, limit)
  ]);

  return { ok: true, traceId, audits, decisions, timeline };
}

module.exports = {
  getTraceBundle
};

