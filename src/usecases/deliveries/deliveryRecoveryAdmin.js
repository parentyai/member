'use strict';

const crypto = require('crypto');

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeDeliveryId(value) {
  if (typeof value !== 'string') throw createHttpError(400, 'deliveryId required');
  const deliveryId = value.trim();
  if (!deliveryId) throw createHttpError(400, 'deliveryId required');
  return deliveryId;
}

function normalizeReason(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw createHttpError(400, 'invalid sealedReason');
  const reason = value.trim();
  if (!reason) return null;
  if (reason.length > 200) throw createHttpError(400, 'sealedReason too long');
  return reason;
}

function computePlanHash(deliveryId, sealedReason) {
  const text = `deliveryId=${deliveryId};action=seal;sealedReason=${sealedReason || ''}`;
  return `seal_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash, deliveryId) {
  return {
    planHash,
    templateKey: 'delivery_recovery',
    templateVersion: '',
    segmentKey: deliveryId
  };
}

function deliverySummary(delivery) {
  if (!delivery) return null;
  const state = delivery.state || null;
  const delivered = delivery.delivered === true;
  const sealed = delivery.sealed === true;
  let recommendedAction = 'INSPECT';
  const allowedActions = [];
  if (delivered || sealed) {
    recommendedAction = 'NO_ACTION';
  } else if (state === 'failed') {
    recommendedAction = 'RETRY_OR_SEAL';
    allowedActions.push('RETRY', 'SEAL');
  } else {
    recommendedAction = 'SEAL';
    allowedActions.push('SEAL');
  }
  return {
    deliveryId: delivery.id || null,
    state,
    delivered,
    sealed,
    reservedAt: delivery.reservedAt || null,
    sentAt: delivery.sentAt || null,
    lastError: delivery.lastError || null,
    recovery: {
      retryPossible: state === 'failed' && !delivered && !sealed,
      canSeal: !delivered,
      recommendedAction,
      allowedActions
    }
  };
}

async function audit(entry, deps) {
  const fn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  return fn(entry);
}

async function getRecoveryStatus(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const deliveryId = normalizeDeliveryId(payload.deliveryId);
  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const delivery = await repo.getDelivery(deliveryId);
  if (!delivery) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.status.view',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    }, deps);
    return {
      statusCode: 404,
      body: { ok: false, reason: 'not_found', deliveryId, traceId: payload.traceId || null }
    };
  }
  const summary = deliverySummary(delivery);
  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_recovery.status.view',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: Object.assign({ ok: true }, summary)
  }, deps);

  return {
    statusCode: 200,
    body: {
      ok: true,
      serverTime: new Date().toISOString(),
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      delivery: summary
    }
  };
}

async function planRecovery(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const deliveryId = normalizeDeliveryId(payload.deliveryId);
  const sealedReason = normalizeReason(payload.sealedReason);
  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const delivery = await repo.getDelivery(deliveryId);
  if (!delivery) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.plan',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    }, deps);
    return {
      statusCode: 404,
      body: { ok: false, reason: 'not_found', deliveryId, traceId: payload.traceId || null }
    };
  }
  if (delivery.delivered === true) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.plan',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'already_delivered', deliveryId }
    }, deps);
    return {
      statusCode: 409,
      body: { ok: false, reason: 'already_delivered', deliveryId, traceId: payload.traceId || null }
    };
  }
  const planHash = computePlanHash(deliveryId, sealedReason);
  const summary = deliverySummary(delivery);
  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_recovery.plan',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      ok: true,
      planHash,
      deliveryId,
      sealedReason,
      state: summary.state,
      sealed: summary.sealed
    }
  }, deps);

  return {
    statusCode: 200,
    body: {
      ok: true,
      serverTime: new Date().toISOString(),
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      delivery: summary,
      planHash,
      sealedReason
    }
  };
}

async function executeRecovery(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const deliveryId = normalizeDeliveryId(payload.deliveryId);
  const sealedReason = normalizeReason(payload.sealedReason);
  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  if (!planHash) throw createHttpError(400, 'planHash required');

  const expectedPlanHash = computePlanHash(deliveryId, sealedReason);
  if (planHash !== expectedPlanHash) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, deliveryId }
    }, deps);
    return {
      statusCode: 409,
      body: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId: payload.traceId || null }
    };
  }

  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const delivery = await repo.getDelivery(deliveryId);
  if (!delivery) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'not_found', deliveryId }
    }, deps);
    return {
      statusCode: 404,
      body: { ok: false, reason: 'not_found', deliveryId, traceId: payload.traceId || null }
    };
  }
  if (delivery.delivered === true) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'already_delivered', deliveryId }
    }, deps);
    return {
      statusCode: 409,
      body: { ok: false, reason: 'already_delivered', deliveryId, traceId: payload.traceId || null }
    };
  }
  if (delivery.sealed === true) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_recovery.execute',
      entityType: 'delivery',
      entityId: deliveryId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: true, alreadySealed: true, deliveryId }
    }, deps);
    return {
      statusCode: 200,
      body: { ok: true, traceId: payload.traceId || null, requestId: payload.requestId || null, deliveryId, alreadySealed: true }
    };
  }

  await repo.sealDeliveryWithId(deliveryId, {
    sealedBy: payload.actor || 'unknown',
    sealedReason
  });
  const updated = await repo.getDelivery(deliveryId);
  const summary = deliverySummary(updated);

  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_recovery.execute',
    entityType: 'delivery',
    entityId: deliveryId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: { ok: true, deliveryId, sealedReason, sealed: true }
  }, deps);

  return {
    statusCode: 200,
    body: {
      ok: true,
      serverTime: new Date().toISOString(),
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      delivery: summary
    }
  };
}

module.exports = {
  normalizeDeliveryId,
  normalizeReason,
  computePlanHash,
  confirmTokenData,
  getRecoveryStatus,
  planRecovery,
  executeRecovery
};
