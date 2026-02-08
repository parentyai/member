'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} required`);
  }
  return value.trim();
}

function buildSuggestion(lineUserId, lastDelivery) {
  if (lastDelivery && !lastDelivery.readAt && !lastDelivery.clickAt) {
    return {
      action: 'SEND_REMINDER',
      reason: 'unread delivery exists',
      confidence: 'MED',
      evidence: {
        lineUserId,
        lastDeliveryId: lastDelivery.id || null,
        lastNoticeId: lastDelivery.noticeId || null
      },
      safety: { ok: true, notes: [] }
    };
  }
  return {
    action: 'NO_ACTION',
    reason: 'no pending reminder',
    confidence: 'LOW',
    evidence: {
      lineUserId,
      lastDeliveryId: lastDelivery ? lastDelivery.id || null : null,
      lastNoticeId: lastDelivery ? lastDelivery.noticeId || null : null
    },
    safety: { ok: true, notes: [] }
  };
}

async function getOpsAssistSuggestion(params, deps) {
  const payload = params || {};
  const lineUserId = requireString(payload.lineUserId, 'lineUserId');

  const deliveries = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const auditRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;

  const deliveryList = await deliveries.listDeliveriesByUser(lineUserId, 1);
  const lastDelivery = deliveryList.length ? deliveryList[0] : null;
  const suggestion = buildSuggestion(lineUserId, lastDelivery);

  const audit = await auditRepo.appendAuditLog({
    action: 'OPS_ASSIST_SUGGESTION',
    eventType: 'OPS_ASSIST_SUGGESTION',
    type: 'OPS_ASSIST_SUGGESTION',
    lineUserId,
    suggestion
  });

  return {
    ok: true,
    lineUserId,
    serverTime: new Date().toISOString(),
    suggestion,
    auditId: audit.id
  };
}

module.exports = {
  getOpsAssistSuggestion
};
