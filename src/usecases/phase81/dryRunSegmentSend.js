'use strict';

const crypto = require('crypto');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { planSegmentSend } = require('../phase67/planSegmentSend');
const { createConfirmToken } = require('../../domain/confirmToken');

async function dryRunSegmentSend(params, deps) {
  const payload = params || {};
  const requestedBy = payload.requestedBy || 'unknown';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const now = deps && deps.now instanceof Date ? deps.now : new Date();

  const plan = await planSegmentSend(payload, Object.assign({}, deps, {
    appendAuditLog: async () => ({ id: 'dryrun_plan_skip' })
  }));

  const targetCount = plan.count;
  const targetsSample = Array.isArray(plan.lineUserIds) ? plan.lineUserIds.slice(0, 3) : [];
  const planSnapshot = { targetCount, sample: targetsSample };
  const confirmToken = createConfirmToken({
    planHash: plan.planHash,
    templateKey: plan.templateKey,
    templateVersion: plan.templateVersion,
    segmentKey: payload.segmentKey
  }, {
    secret: deps && deps.confirmTokenSecret,
    now
  });
  const confirmTokenId = crypto.createHash('sha256').update(confirmToken).digest('hex').slice(0, 12);

  await appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.dry_run',
    entityType: 'segment_send',
    entityId: plan.templateKey,
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    templateKey: plan.templateKey,
    payloadSummary: {
      templateKey: plan.templateKey,
      templateVersion: plan.templateVersion,
      segmentKey: payload.segmentKey || null,
      targetCount,
      planHash: plan.planHash,
      confirmTokenId
    },
    snapshot: {
      templateKey: plan.templateKey,
      templateVersion: plan.templateVersion,
      segmentKey: payload.segmentKey || null,
      filterSnapshot: payload.filterSnapshot || null,
      planHash: plan.planHash,
      planSnapshot,
      targetsSample,
      dryRun: true,
      confirmTokenId,
      serverTime: now.toISOString()
    }
  });

  return {
    ok: true,
    serverTime: now.toISOString(),
    traceId: traceId || undefined,
    requestId: requestId || undefined,
    dryRun: true,
    segmentKey: payload.segmentKey || null,
    templateKey: plan.templateKey,
    templateVersion: plan.templateVersion,
    targetCount,
    targetsSample,
    blocking: [],
    planHash: plan.planHash,
    planSnapshot,
    confirmToken,
    confirmTokenId
  };
}

module.exports = {
  dryRunSegmentSend
};
