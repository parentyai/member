'use strict';

const { appendAuditLog } = require('../audit/appendAuditLog');
const { planSegmentSend } = require('../phase67/planSegmentSend');
const { createConfirmToken } = require('../../domain/confirmToken');

async function dryRunSegmentSend(params, deps) {
  const payload = params || {};
  const requestedBy = payload.requestedBy || 'unknown';
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

  await appendAuditLog({
    actor: requestedBy,
    action: 'segment_send.dry_run',
    entityType: 'segment_send',
    entityId: plan.templateKey,
    templateKey: plan.templateKey,
    payloadSummary: {
      templateKey: plan.templateKey,
      templateVersion: plan.templateVersion,
      segmentKey: payload.segmentKey || null,
      targetCount,
      planHash: plan.planHash,
      confirmToken
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
      serverTime: now.toISOString()
    }
  });

  return {
    ok: true,
    serverTime: now.toISOString(),
    dryRun: true,
    segmentKey: payload.segmentKey || null,
    templateKey: plan.templateKey,
    templateVersion: plan.templateVersion,
    targetCount,
    targetsSample,
    blocking: [],
    planHash: plan.planHash,
    planSnapshot,
    confirmToken
  };
}

module.exports = {
  dryRunSegmentSend
};
