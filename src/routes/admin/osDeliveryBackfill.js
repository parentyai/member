'use strict';

const crypto = require('crypto');

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { createConfirmToken, verifyConfirmToken } = require('../../domain/confirmToken');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, parseJson } = require('./osContext');

const MAX_LIMIT = 1000;

function normalizeLimit(value) {
  if (value === undefined || value === null || value === '') return 200;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num) || num < 1 || num > MAX_LIMIT) {
    throw new Error(`limit must be integer 1-${MAX_LIMIT}`);
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

async function buildSummary(limit) {
  const raw = await deliveriesRepo.getDeliveredAtBackfillSummary(limit);
  return Object.assign({}, raw, {
    candidateHash: hashCandidates(raw.candidates)
  });
}

function resolveLimitFromQuery(req) {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    return normalizeLimit(url.searchParams.get('limit'));
  } catch (_err) {
    return null;
  }
}

async function handleStatus(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  const limit = resolveLimitFromQuery(req);
  if (!limit) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: `limit must be integer 1-${MAX_LIMIT}`, traceId }));
    return;
  }

  const summary = await buildSummary(limit);
  await appendAuditLog({
    actor,
    action: 'delivery_backfill.status.view',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      limit,
      deliveredCount: summary.deliveredCount,
      missingDeliveredAtCount: summary.missingDeliveredAtCount,
      fixableCount: summary.fixableCount,
      unfixableCount: summary.unfixableCount
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    summary: summarizeForResponse(summary)
  }));
}

async function handlePlan(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  let limit;
  try {
    limit = normalizeLimit(payload.limit);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const summary = await buildSummary(limit);
  const planHash = computePlanHash(summary);
  const confirmToken = createConfirmToken(confirmTokenData(planHash, limit), { now: new Date() });
  await appendAuditLog({
    actor,
    action: 'delivery_backfill.plan',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId,
    requestId,
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
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    planHash,
    confirmToken,
    summary: summarizeForResponse(summary)
  }));
}

async function handleExecute(req, res, body) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const payload = parseJson(body, res);
  if (!payload) return;

  const planHash = typeof payload.planHash === 'string' ? payload.planHash : null;
  const confirmToken = typeof payload.confirmToken === 'string' ? payload.confirmToken : null;
  if (!planHash || !confirmToken) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'planHash/confirmToken required', traceId }));
    return;
  }

  let limit;
  try {
    limit = normalizeLimit(payload.limit);
  } catch (err) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: err && err.message ? err.message : 'invalid', traceId }));
    return;
  }

  const summary = await buildSummary(limit);
  const expectedPlanHash = computePlanHash(summary);
  if (planHash !== expectedPlanHash) {
    await appendAuditLog({
      actor,
      action: 'delivery_backfill.execute',
      entityType: 'notification_deliveries',
      entityId: 'deliveredAt',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, limit }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'plan_hash_mismatch', expectedPlanHash, traceId }));
    return;
  }

  const confirmOk = verifyConfirmToken(confirmToken, confirmTokenData(planHash, limit), { now: new Date() });
  if (!confirmOk) {
    await appendAuditLog({
      actor,
      action: 'delivery_backfill.execute',
      entityType: 'notification_deliveries',
      entityId: 'deliveredAt',
      traceId,
      requestId,
      payloadSummary: { ok: false, reason: 'confirm_token_mismatch', limit }
    });
    res.writeHead(409, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, reason: 'confirm_token_mismatch', traceId }));
    return;
  }

  const result = await deliveriesRepo.applyDeliveredAtBackfill(summary.candidates, {
    actor,
    backfilledAt: new Date().toISOString()
  });
  const after = await buildSummary(limit);
  await appendAuditLog({
    actor,
    action: 'delivery_backfill.execute',
    entityType: 'notification_deliveries',
    entityId: 'deliveredAt',
    traceId,
    requestId,
    payloadSummary: {
      ok: true,
      limit,
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      remainingMissingDeliveredAtCount: after.missingDeliveredAtCount,
      remainingFixableCount: after.fixableCount
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    serverTime: new Date().toISOString(),
    traceId,
    requestId,
    result: {
      updatedCount: result.updatedCount,
      skippedCount: result.skippedCount,
      backfilledAt: result.backfilledAt
    },
    summaryAfter: summarizeForResponse(after)
  }));
}

module.exports = {
  handleStatus,
  handlePlan,
  handleExecute
};

