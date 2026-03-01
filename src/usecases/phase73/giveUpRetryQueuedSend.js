'use strict';

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const { verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { computeRetryPlanHash, confirmTokenData } = require('./planRetryQueuedSend');

function normalizeReason(value) {
  if (typeof value !== 'string') return 'manual_give_up';
  const normalized = value.trim();
  return normalized || 'manual_give_up';
}

async function giveUpRetryQueuedSend(params, deps) {
  const payload = params || {};
  const queueId = payload.queueId;
  if (!queueId) throw new Error('queueId required');

  const actor = payload.actor || payload.decidedBy || payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const payloadPlanHash = typeof payload.planHash === 'string' && payload.planHash.trim().length > 0 ? payload.planHash.trim() : null;
  const confirmToken = typeof payload.confirmToken === 'string' && payload.confirmToken.trim().length > 0 ? payload.confirmToken.trim() : null;
  const reason = normalizeReason(payload.reason);

  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const item = await repo.getQueueItem(queueId);
  if (!item) return { ok: false, reason: 'queue_not_found', status: 404 };
  if (item.status && item.status !== 'PENDING') {
    return { ok: false, reason: 'queue_not_pending', status: 409, queueStatus: item.status };
  }

  const expectedPlanHash = computeRetryPlanHash(queueId, item);
  if (!payloadPlanHash || !confirmToken) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.give_up',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'confirm_token_required', queueId }
    });
    return { ok: false, reason: 'confirm_token_required', status: 400 };
  }
  if (payloadPlanHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.give_up',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', queueId, expectedPlanHash }
    });
    return { ok: false, reason: 'plan_hash_mismatch', status: 409, expectedPlanHash };
  }

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(expectedPlanHash, queueId), {
    secret: deps && deps.confirmTokenSecret,
    now
  });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.give_up',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', queueId }
    });
    return { ok: false, reason: 'confirm_token_mismatch', status: 409 };
  }

  await repo.markGivenUp(queueId, {
    reason,
    actor,
    resolvedAt: now.toISOString()
  });

  await appendAuditLog({
    actor,
    action: 'retry_queue.give_up',
    entityType: 'send_retry_queue',
    entityId: queueId,
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    payloadSummary: {
      ok: true,
      queueId,
      status: 'GAVE_UP',
      reason,
      templateKey: item.templateKey || null,
      lineUserId: item.lineUserId || null,
      lastError: item.lastError || null
    }
  });

  return {
    ok: true,
    queueId,
    status: 'GAVE_UP',
    reason,
    serverTime: now.toISOString()
  };
}

module.exports = {
  giveUpRetryQueuedSend
};
