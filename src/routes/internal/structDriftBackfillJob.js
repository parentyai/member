'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { runStructDriftBackfill } = require('../../usecases/structure/runStructDriftBackfill');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');
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

function resolveTraceId(req, payload) {
  const headerTraceId = req && req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : '';
  if (headerTraceId) return headerTraceId;
  if (payload && typeof payload.traceId === 'string' && payload.traceId.trim()) return payload.traceId.trim();
  return null;
}

function resolveOutcome(result) {
  const summary = result && result.summary && typeof result.summary === 'object' ? result.summary : {};
  if (summary.dryRun === true) return { state: 'success', reason: 'dry_run' };
  if (summary.hasMore === true) return { state: 'partial', reason: 'completed_with_more_remaining' };
  if (Number(summary.changedCount) === 0) return { state: 'success', reason: 'no_changes' };
  return { state: 'success', reason: 'completed' };
}

async function handleStructDriftBackfillJob(req, res, bodyText, deps) {
  const runStructDriftBackfillFn = deps && typeof deps.runStructDriftBackfillFn === 'function'
    ? deps.runStructDriftBackfillFn
    : runStructDriftBackfill;
  const appendAuditLogFn = deps && typeof deps.appendAuditLogFn === 'function'
    ? deps.appendAuditLogFn
    : appendAuditLog;
  if (req.method !== 'POST') {
    writeJson(res, 404, { ok: false, error: 'not found' });
    return;
  }
  if (!requireInternalJobToken(req, res)) return;

  const payload = parseJson(bodyText);
  if (!payload) {
    writeJson(res, 400, { ok: false, error: 'invalid json' });
    return;
  }

  const traceId = resolveTraceId(req, payload);
  const result = await runStructDriftBackfillFn({
    dryRun: payload.dryRun,
    apply: payload.apply,
    scanLimit: payload.scanLimit,
    resumeAfterUserId: payload.resumeAfterUserId
  });
  const summary = result.summary || {};

  try {
    await appendAuditLogFn({
      actor: 'struct_drift_backfill_job',
      action: 'struct_drift.backfill.execute',
      entityType: 'struct_drift',
      entityId: 'global',
      traceId: traceId || undefined,
      payloadSummary: {
        mode: summary.mode || null,
        dryRun: summary.dryRun,
        scanLimit: summary.scanLimit,
        resumeAfterUserId: summary.resumeAfterUserId || null,
        summary,
        changedCount: Number.isFinite(Number(summary.changedCount)) ? Number(summary.changedCount) : 0,
        scenarioCandidateIds: Array.isArray(result.scenarioCandidates)
          ? result.scenarioCandidates.map((row) => row.id).slice(0, 50)
          : [],
        opsStateCandidate: result.opsStateCandidate ? {
          targetCollection: result.opsStateCandidate.targetCollection,
          targetDocId: result.opsStateCandidate.targetDocId
        } : null
      }
    });
  } catch (_err) {
    // best-effort audit
  }

  writeJson(res, 200, Object.assign({}, result, { traceId }), resolveOutcome(result));
}

module.exports = {
  handleStructDriftBackfillJob,
  runStructDriftBackfill
};
