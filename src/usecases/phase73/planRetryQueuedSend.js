'use strict';

const crypto = require('crypto');

const sendRetryQueueRepo = require('../../repos/firestore/sendRetryQueueRepo');
const { createConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../audit/appendAuditLog');

function normalizeString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function resolvePayloadSnapshot(item) {
  if (!item || typeof item !== 'object') return null;
  if (item.payloadSnapshot && typeof item.payloadSnapshot === 'object') return item.payloadSnapshot;
  return null;
}

function computeRetryPlanHash(queueId, item) {
  const snapshot = resolvePayloadSnapshot(item);
  const planInput = {
    queueId: normalizeString(queueId),
    status: normalizeString(item && item.status),
    templateKey: normalizeString(item && item.templateKey),
    lineUserId: normalizeString(item && item.lineUserId),
    notificationId: normalizeString((snapshot && snapshot.notificationId) || ''),
    deliveryId: normalizeString((snapshot && snapshot.deliveryId) || ''),
    updatedAt: item && item.updatedAt ? String(item.updatedAt) : '',
    createdAt: item && item.createdAt ? String(item.createdAt) : ''
  };
  const hash = crypto.createHash('sha256').update(JSON.stringify(planInput), 'utf8').digest('hex').slice(0, 32);
  return `rq_${hash}`;
}

function confirmTokenData(planHash, queueId) {
  return {
    planHash,
    templateKey: 'retry_queue',
    templateVersion: '',
    segmentKey: queueId
  };
}

async function planRetryQueuedSend(params, deps) {
  const payload = params || {};
  const queueId = payload.queueId;
  if (!queueId) throw new Error('queueId required');

  const actor = payload.actor || payload.decidedBy || payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;

  const repo = deps && deps.sendRetryQueueRepo ? deps.sendRetryQueueRepo : sendRetryQueueRepo;
  const item = await repo.getQueueItem(queueId);
  if (!item) return { ok: false, reason: 'queue_not_found', status: 404 };
  if (item.status && item.status !== 'PENDING') {
    return { ok: false, reason: 'queue_not_pending', status: 409, queueStatus: item.status };
  }

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const planHash = computeRetryPlanHash(queueId, item);
  const confirmToken = createConfirmToken(confirmTokenData(planHash, queueId), {
    secret: deps && deps.confirmTokenSecret,
    now
  });

  const snapshot = resolvePayloadSnapshot(item);
  const notificationId = snapshot && typeof snapshot.notificationId === 'string' ? snapshot.notificationId : null;
  const deliveryId = snapshot && typeof snapshot.deliveryId === 'string' ? snapshot.deliveryId : null;

  await appendAuditLog({
    actor,
    action: 'retry_queue.plan',
    entityType: 'send_retry_queue',
    entityId: queueId,
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    payloadSummary: {
      queueId,
      planHash,
      status: item.status || null,
      templateKey: item.templateKey || null,
      lineUserId: item.lineUserId || null,
      notificationId,
      deliveryId
    }
  });

  return {
    ok: true,
    serverTime: now.toISOString(),
    queueId,
    planHash,
    confirmToken,
    itemSummary: {
      id: item.id,
      status: item.status || null,
      templateKey: item.templateKey || null,
      lineUserId: item.lineUserId || null,
      notificationId,
      deliveryId,
      updatedAt: item.updatedAt || null,
      createdAt: item.createdAt || null,
      lastError: item.lastError || null
    }
  };
}

module.exports = {
  planRetryQueuedSend,
  computeRetryPlanHash,
  confirmTokenData
};

