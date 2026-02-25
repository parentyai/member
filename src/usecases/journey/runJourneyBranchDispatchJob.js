'use strict';

const journeyBranchQueueRepo = require('../../repos/firestore/journeyBranchQueueRepo');
const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}

function resolveFeatureEnabled() {
  const raw = process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function resolveLimit(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return 100;
  return Math.min(Math.floor(num), 500);
}

function plusMinutes(baseIso, minutes) {
  const parsed = Date.parse(baseIso || new Date().toISOString());
  if (!Number.isFinite(parsed)) return new Date(Date.now() + (minutes * 60000)).toISOString();
  return new Date(parsed + (minutes * 60000)).toISOString();
}

async function runJourneyBranchDispatchJob(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const queueRepo = resolvedDeps.journeyBranchQueueRepo || journeyBranchQueueRepo;
  const deliveries = resolvedDeps.deliveriesRepo || deliveriesRepo;
  const events = resolvedDeps.eventsRepo || eventsRepo;
  const auditRepo = resolvedDeps.auditLogsRepo || auditLogsRepo;

  const dryRun = normalizeBoolean(payload.dryRun, false);
  const nowIso = payload.now || new Date().toISOString();
  const limit = resolveLimit(payload.limit);
  const actor = typeof payload.actor === 'string' && payload.actor.trim()
    ? payload.actor.trim()
    : 'journey_branch_dispatch_job';
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim() ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null;

  if (!resolveFeatureEnabled()) {
    return {
      ok: true,
      status: 'disabled_by_flag',
      dryRun,
      scannedCount: 0,
      sentCount: 0,
      skippedCount: 0,
      failedCount: 0,
      items: []
    };
  }

  const queueItems = await queueRepo.listDispatchReadyJourneyBranches({
    now: nowIso,
    limit
  });

  let sentCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  const items = [];

  for (const item of queueItems) {
    const queueId = item && item.id ? item.id : '';
    if (!queueId) continue;
    const effect = item && item.effect && typeof item.effect === 'object' ? item.effect : {};
    const nextTemplateId = typeof effect.nextTemplateId === 'string' && effect.nextTemplateId.trim()
      ? effect.nextTemplateId.trim()
      : null;
    try {
      if (!nextTemplateId) {
        if (!dryRun) {
          // eslint-disable-next-line no-await-in-loop
          await queueRepo.patchJourneyBranchItem(queueId, {
            status: 'skipped',
            branchDispatchStatus: 'no_template',
            dispatchedAt: nowIso,
            lastError: null
          });
          if (typeof deliveries.patchDeliveryBranchOutcome === 'function') {
            // eslint-disable-next-line no-await-in-loop
            await deliveries.patchDeliveryBranchOutcome(item.deliveryId, {
              branchRuleId: item.ruleId,
              branchDispatchStatus: 'skipped_no_template'
            }).catch(() => null);
          }
        }
        skippedCount += 1;
        items.push({ id: queueId, status: 'skipped', reason: 'no_template' });
        continue;
      }

      if (!dryRun) {
        // Branch dispatch is evidence-first: emit event and mark queue as sent.
        // Actual notification fan-out stays on existing admin send pipeline.
        // eslint-disable-next-line no-await-in-loop
        await events.createEvent({
          lineUserId: item.lineUserId,
          type: 'journey_branch_dispatch',
          deliveryId: item.deliveryId,
          todoKey: item.todoKey || null,
          ruleId: item.ruleId,
          nextTemplateId,
          traceId,
          requestId,
          actor,
          createdAt: nowIso
        }).catch(() => null);

        // eslint-disable-next-line no-await-in-loop
        await queueRepo.patchJourneyBranchItem(queueId, {
          status: 'sent',
          branchDispatchStatus: 'sent',
          dispatchedAt: nowIso,
          lastError: null,
          attempts: (Number(item.attempts) || 0) + 1
        });

        if (typeof deliveries.patchDeliveryBranchOutcome === 'function') {
          // eslint-disable-next-line no-await-in-loop
          await deliveries.patchDeliveryBranchOutcome(item.deliveryId, {
            branchRuleId: item.ruleId,
            branchDispatchStatus: 'sent'
          }).catch(() => null);
        }
      }

      sentCount += 1;
      items.push({ id: queueId, status: 'sent', nextTemplateId });
    } catch (err) {
      failedCount += 1;
      const message = err && err.message ? String(err.message) : 'dispatch_failed';
      if (!dryRun) {
        const attempts = (Number(item.attempts) || 0) + 1;
        // eslint-disable-next-line no-await-in-loop
        await queueRepo.patchJourneyBranchItem(queueId, {
          status: 'failed',
          branchDispatchStatus: 'failed',
          lastError: message,
          attempts,
          nextAttemptAt: plusMinutes(nowIso, Math.min(60, 10 * attempts))
        }).catch(() => null);
        if (typeof deliveries.patchDeliveryBranchOutcome === 'function') {
          // eslint-disable-next-line no-await-in-loop
          await deliveries.patchDeliveryBranchOutcome(item.deliveryId, {
            branchRuleId: item.ruleId,
            branchDispatchStatus: 'failed'
          }).catch(() => null);
        }
      }
      items.push({ id: queueId, status: 'failed', error: message });
    }
  }

  const result = {
    ok: true,
    status: 'completed',
    dryRun,
    scannedCount: queueItems.length,
    sentCount,
    skippedCount,
    failedCount,
    items
  };

  await auditRepo.appendAuditLog({
    action: 'journey_branch.dispatch',
    eventType: 'journey_branch.dispatch',
    type: 'journey_branch.dispatch',
    actor,
    traceId,
    requestId,
    payloadSummary: {
      dryRun,
      scannedCount: queueItems.length,
      sentCount,
      skippedCount,
      failedCount
    }
  }).catch(() => null);

  return result;
}

module.exports = {
  runJourneyBranchDispatchJob
};
