'use strict';

const { recordOpsReview } = require('../usecases/phase5/setOpsReview');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./admin/osContext');

function parseJson(body, res) {
  try {
    return JSON.parse(body || '{}');
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'invalid json' }));
    return null;
  }
}

function handleError(res, err) {
  const message = err && err.message ? err.message : 'error';
  if (message.includes('required') || message.includes('invalid')) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: message }));
    return;
  }
  res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({ ok: false, error: 'error' }));
}

async function handleOpsReview(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;
  try {
    const review = await recordOpsReview({
      reviewedBy: payload.reviewedBy,
      reviewedAt: payload.reviewedAt
    });
    try {
      await appendAuditLog({
        actor,
        action: 'ops_review.submit',
        entityType: 'ops_state',
        entityId: 'global',
        traceId,
        requestId,
        payloadSummary: {
          reviewedBy: review.reviewedBy || null,
          hasReviewedAt: Boolean(payload.reviewedAt)
        }
      });
    } catch (_err) {
      // best-effort only
    }
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true, traceId, requestId }));
  } catch (err) {
    handleError(res, err);
  }
}

module.exports = {
  handleOpsReview
};
