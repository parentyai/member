'use strict';

const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { runStructDriftBackfill } = require('../../usecases/structure/runStructDriftBackfill');
const { requireInternalJobToken } = require('./cityPackSourceAuditJob');

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

function resolveTraceId(req, payload) {
  const headerTraceId = req && req.headers && typeof req.headers['x-trace-id'] === 'string'
    ? req.headers['x-trace-id'].trim()
    : '';
  if (headerTraceId) return headerTraceId;
  if (payload && typeof payload.traceId === 'string' && payload.traceId.trim()) return payload.traceId.trim();
  return null;
}

async function handleStructDriftBackfillJob(req, res, bodyText) {
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
  const result = await runStructDriftBackfill({
    dryRun: payload.dryRun,
    apply: payload.apply,
    scanLimit: payload.scanLimit,
    resumeAfterUserId: payload.resumeAfterUserId
  });
  const summary = result.summary || {};

  try {
    await appendAuditLog({
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

  writeJson(res, 200, Object.assign({}, result, { traceId }));
}

module.exports = {
  handleStructDriftBackfillJob,
  runStructDriftBackfill
};
