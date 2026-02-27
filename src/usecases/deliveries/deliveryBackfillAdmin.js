'use strict';

const crypto = require('crypto');

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');

const MAX_LIMIT = 1000;

function createHttpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return 200;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > MAX_LIMIT) {
    throw createHttpError(400, `limit must be integer 1-${MAX_LIMIT}`);
  }
  return num;
}

function hashCandidates(candidates) {
  const list = Array.isArray(candidates) ? candidates : [];
  const text = list
    .map((entry) => {
      const deliveryId = entry && typeof entry.deliveryId === 'string' ? entry.deliveryId : '';
      const sentAtIso = entry && typeof entry.sentAtIso === 'string' ? entry.sentAtIso : '';
      return `${deliveryId}:${sentAtIso}`;
    })
    .join('|');
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24);
}

function computePlanHash(summary) {
  const text = [
    `limit=${summary.limit}`,
    `deliveredCount=${summary.deliveredCount}`,
    `missingDeliveredAtCount=${summary.missingDeliveredAtCount}`,
    `fixableCount=${summary.fixableCount}`,
    `unfixableCount=${summary.unfixableCount}`,
    `candidateHash=${summary.candidateHash}`
  ].join(';');
  return `delivered_at_backfill_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

function confirmTokenData(planHash, limit) {
  return {
    planHash,
    templateKey: 'delivery_backfill',
    templateVersion: '',
    segmentKey: String(limit)
  };
}

function summarizeForResponse(summary) {
  return {
    limit: summary.limit,
    deliveredCount: summary.deliveredCount,
    missingDeliveredAtCount: summary.missingDeliveredAtCount,
    fixableCount: summary.fixableCount,
    unfixableCount: summary.unfixableCount,
    candidateCount: summary.candidates.length,
    candidateHash: summary.candidateHash,
    sampleFixable: summary.sampleFixable,
    sampleUnfixable: summary.sampleUnfixable,
    candidates: summary.candidates
  };
}

async function buildSummary(limit, deps) {
  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const raw = await repo.getDeliveredAtBackfillSummary(limit);
  return Object.assign({}, raw, {
    candidateHash: hashCandidates(raw.candidates)
  });
}

async function audit(entry, deps) {
  const fn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  return fn(entry);
}

async function getBackfillStatus(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit);
  const summary = await buildSummary(limit, deps);

  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_backfill.status.view',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      ok: true,
      limit,
      deliveredCount: summary.deliveredCount,
      missingDeliveredAtCount: summary.missingDeliveredAtCount,
      fixableCount: summary.fixableCount,
      unfixableCount: summary.unfixableCount
    }
  }, deps);

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    summary: summarizeForResponse(summary)
  };
}

async function planBackfill(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit);
  const summary = await buildSummary(limit, deps);
  const planHash = computePlanHash(summary);

  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_backfill.plan',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      ok: true,
      limit,
      planHash,
      deliveredCount: summary.deliveredCount,
      missingDeliveredAtCount: summary.missingDeliveredAtCount,
      fixableCount: summary.fixableCount,
      unfixableCount: summary.unfixableCount,
      candidateHash: summary.candidateHash
    }
  }, deps);

  return {
    ok: true,
    serverTime: new Date().toISOString(),
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    planHash,
    summary: summarizeForResponse(summary)
  };
}

async function executeBackfill(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const limit = normalizeLimit(payload.limit);
  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  if (!planHash) throw createHttpError(400, 'planHash required');

  const summary = await buildSummary(limit, deps);
  const expectedPlanHash = computePlanHash(summary);
  if (planHash !== expectedPlanHash) {
    await audit({
      actor: payload.actor || 'unknown',
      action: 'delivery_backfill.execute',
      entityType: 'notification_deliveries',
      entityId: 'deliveredAt',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, limit }
    }, deps);
    return {
      statusCode: 409,
      body: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId: payload.traceId || null }
    };
  }

  const repo = deps && deps.deliveriesRepo ? deps.deliveriesRepo : deliveriesRepo;
  const result = await repo.applyDeliveredAtBackfill(summary.candidates, {
    actor: payload.actor || 'unknown',
    backfilledAt: new Date().toISOString()
  });
  const after = await buildSummary(limit, deps);

  await audit({
    actor: payload.actor || 'unknown',
    action: 'delivery_backfill.execute',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      ok: true,
      limit,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      remainingMissingDeliveredAtCount: after.missingDeliveredAtCount,
      remainingFixableCount: after.fixableCount
    }
  }, deps);

  return {
    statusCode: 200,
    body: {
      ok: true,
      serverTime: new Date().toISOString(),
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      result: {
        updatedCount: result.updatedCount,
        skippedCount: result.skippedCount,
        backfilledAt: result.backfilledAt
      },
      summaryAfter: summarizeForResponse(after)
    }
  };
}

module.exports = {
  MAX_LIMIT,
  normalizeLimit,
  computePlanHash,
  confirmTokenData,
  getBackfillStatus,
  planBackfill,
  executeBackfill
};
