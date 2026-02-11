'use strict';

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { testSendNotification } = require('../notifications/testSendNotification');
const { computeRetryPlanHash, confirmTokenData } = require('./planRetryQueuedSend');

function resolvePayloadSnapshot(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.payloadSnapshot && typeof item.payloadSnapshot === 'object') return item.payloadSnapshot;
  return null;
}

async function retryQueuedSend(params, deps) {
  const payload = params || {};
  const queueId = payload.queueId;
  if (!queueId) throw new Error('queueId required');

  const actor = payload.actor || payload.decidedBy || payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const payloadPlanHash = typeof payload.planHash === 'string' && payload.planHash.trim().length > 0 ? payload.planHash.trim() : null;
  const confirmToken = typeof payload.confirmToken === 'string' && payload.confirmToken.trim().length > 0 ? payload.confirmToken.trim() : null;

  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const sendFn = deps && deps.sendFn ? deps.sendFn : testSendNotification;
  const killSwitchFn = deps && deps.getKillSwitch ? deps.getKillSwitch : systemFlagsRepo.getKillSwitch;

  const item = await repo.getQueueItem(queueId);
  if (!item) return { ok: false, reason: 'queue_not_found', status: 404 };
  if (item.status && item.status !== 'PENDING') {
    return { ok: false, reason: 'queue_not_pending', status: 409, queueStatus: item.status };
  }

  const snapshot = resolvePayloadSnapshot(item);
  if (!snapshot || !snapshot.lineUserId) {
    return { ok: false, reason: 'payload_missing', status: 500 };
  }

  const killSwitch = await killSwitchFn();
  if (killSwitch) {
    return { ok: false, reason: 'kill_switch_on' };
  }

  const expectedPlanHash = computeRetryPlanHash(queueId, item);
  if (!payloadPlanHash || !confirmToken) {
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
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
      action: 'retry_queue.execute',
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
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', queueId }
    });
    return { ok: false, reason: 'confirm_token_mismatch', status: 409 };
  }

  try {
    await sendFn({
      lineUserId: snapshot.lineUserId,
      text: snapshot.text || '',
      notificationId: snapshot.notificationId || item.templateKey || 'retry',
      deliveryId: snapshot.deliveryId || null,
      killSwitch
    }, deps);
    await repo.markDone(queueId);
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: true,
        queueId,
        templateKey: item.templateKey || null,
        lineUserId: snapshot.lineUserId || null,
        notificationId: snapshot.notificationId || null,
        deliveryId: snapshot.deliveryId || null
      }
    });
    return { ok: true, queueId };
  } catch (err) {
    const message = err && err.message ? err.message : 'send_failed';
    await repo.markFailed(queueId, message);
    await appendAuditLog({
      actor,
      action: 'retry_queue.execute',
      entityType: 'send_retry_queue',
      entityId: queueId,
      traceId: traceId || undefined,
      requestId: requestId || undefined,
      payloadSummary: {
        ok: false,
        reason: 'send_failed',
        queueId,
        error: message,
        templateKey: item.templateKey || null,
        lineUserId: snapshot.lineUserId || null,
        notificationId: snapshot.notificationId || null,
        deliveryId: snapshot.deliveryId || null
      }
    });
    return { ok: false, reason: 'send_failed', error: message };
  }
}

module.exports = {
  retryQueuedSend
};
