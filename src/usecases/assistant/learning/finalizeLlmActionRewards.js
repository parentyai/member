'use strict';

const llmActionLogsRepo = require('../../../repos/firestore/llmActionLogsRepo');
const llmBanditStateRepo = require('../../../repos/firestore/llmBanditStateRepo');
const llmContextualBanditStateRepo = require('../../../repos/firestore/llmContextualBanditStateRepo');
const deliveriesRepo = require('../../../repos/firestore/deliveriesRepo');
const journeyTodoItemsRepo = require('../../../repos/firestore/journeyTodoItemsRepo');
const { appendAuditLog } = require('../../audit/appendAuditLog');

const DEFAULT_REWARD_WINDOW_HOURS = 48;
const MAX_REWARD_WINDOW_HOURS = 24 * 14;

const DEFAULT_REWARD_WEIGHTS = Object.freeze({
  click: 1,
  taskComplete: 3,
  blockedResolved: 2,
  citationMissing: -3,
  wrongEvidence: -5
});

function toDate(value) {
  return llmActionLogsRepo.toDate(value);
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function normalizeWindowHours(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return DEFAULT_REWARD_WINDOW_HOURS;
  return Math.min(MAX_REWARD_WINDOW_HOURS, Math.max(1, Math.floor(num)));
}

function isWithinWindow(dateValue, fromAt, toAt) {
  const date = toDate(dateValue);
  if (!date || !fromAt || !toAt) return false;
  const ms = date.getTime();
  return ms >= fromAt.getTime() && ms <= toAt.getTime();
}

function hasCitationMissing(logRow) {
  const blockedReasons = Array.isArray(logRow && logRow.blockedReasons) ? logRow.blockedReasons : [];
  return blockedReasons.includes('citation_missing') || (logRow && logRow.evidenceOutcome === 'INSUFFICIENT');
}

function hasWrongEvidence(logRow) {
  const blockedReasons = Array.isArray(logRow && logRow.blockedReasons) ? logRow.blockedReasons : [];
  return blockedReasons.includes('wrong_evidence');
}

async function detectClickSignal(lineUserId, fromAt, toAt, deps) {
  const repo = deps.deliveriesRepo || deliveriesRepo;
  const rows = await repo.listDeliveriesByUser(lineUserId, 200).catch(() => []);
  return rows.some((row) => isWithinWindow(row && row.clickAt, fromAt, toAt));
}

async function detectTaskCompleteSignal(lineUserId, fromAt, toAt, deps) {
  const repo = deps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const rows = await repo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 200 }).catch(() => []);
  return rows.some((row) => isWithinWindow(row && row.completedAt, fromAt, toAt));
}

async function detectBlockedResolvedSignal(logRow, fromAt, toAt, deps) {
  const blockedReasons = Array.isArray(logRow && logRow.blockedReasons) ? logRow.blockedReasons : [];
  if (!blockedReasons.length && logRow.evidenceOutcome !== 'BLOCKED') return false;
  const repo = deps.llmActionLogsRepo || llmActionLogsRepo;
  const rows = await repo.listLlmActionLogsByLineUserId({
    lineUserId: logRow.lineUserId,
    fromAt,
    toAt,
    limit: 100
  }).catch(() => []);
  return rows.some((row) => {
    if (!row || row.id === logRow.id) return false;
    const blocked = Array.isArray(row.blockedReasons) ? row.blockedReasons.filter(Boolean).length > 0 : false;
    return row.evidenceOutcome === 'SUPPORTED' && blocked === false;
  });
}

function computeReward(signals, weights) {
  const applied = weights && typeof weights === 'object' ? weights : DEFAULT_REWARD_WEIGHTS;
  let reward = 0;
  if (signals.click) reward += applied.click;
  if (signals.taskComplete) reward += applied.taskComplete;
  if (signals.blockedResolved) reward += applied.blockedResolved;
  if (signals.citationMissing) reward += applied.citationMissing;
  if (signals.wrongEvidence) reward += applied.wrongEvidence;
  return Number(reward.toFixed(6));
}

async function finalizeLlmActionRewards(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.llmActionLogsRepo || llmActionLogsRepo;
  const banditRepo = resolvedDeps.llmBanditStateRepo || llmBanditStateRepo;
  const contextualBanditRepo = resolvedDeps.llmContextualBanditStateRepo || llmContextualBanditStateRepo;

  const dryRun = payload.dryRun === true;
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(500, Math.floor(Number(payload.limit)))) : 100;
  const rewardWindowHours = normalizeWindowHours(payload.rewardWindowHours);
  const nowAt = toDate(payload.now) || new Date();

  const rows = await repo.listPendingLlmActionLogs({ limit });
  const summary = {
    ok: true,
    dryRun,
    limit,
    rewardWindowHours,
    processed: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    traceId: payload.traceId || null,
    details: []
  };

  for (const row of rows) {
    summary.processed += 1;
    const createdAt = toDate(row && row.createdAt);
    if (!createdAt) {
      summary.skipped += 1;
      summary.details.push({ id: row.id, reason: 'invalid_createdAt' });
      continue;
    }

    const endAt = new Date(createdAt.getTime() + (rewardWindowHours * 60 * 60 * 1000));
    if (endAt.getTime() > nowAt.getTime()) {
      summary.skipped += 1;
      summary.details.push({ id: row.id, reason: 'window_not_elapsed' });
      continue;
    }

    try {
      const signals = {
        click: await detectClickSignal(row.lineUserId, createdAt, endAt, resolvedDeps),
        taskComplete: await detectTaskCompleteSignal(row.lineUserId, createdAt, endAt, resolvedDeps),
        blockedResolved: await detectBlockedResolvedSignal(row, createdAt, endAt, resolvedDeps),
        citationMissing: hasCitationMissing(row),
        wrongEvidence: hasWrongEvidence(row)
      };
      const reward = computeReward(signals, payload.rewardWeights || DEFAULT_REWARD_WEIGHTS);

      if (!dryRun) {
        await repo.patchLlmActionLog(row.id, {
          rewardPending: false,
          reward,
          rewardSignals: signals,
          rewardVersion: 'v1',
          rewardWindowHours,
          rewardFinalizedAt: nowAt.toISOString()
        });

        const chosenAction = row && row.chosenAction && typeof row.chosenAction === 'object' ? row.chosenAction : {};
        const armId = typeof chosenAction.armId === 'string' ? chosenAction.armId.trim() : '';
        const segmentKey = typeof row.segmentKey === 'string' ? row.segmentKey.trim() : '';
        if (row && row.banditEnabled === true && segmentKey && armId) {
          await banditRepo.recordBanditReward({
            segmentKey,
            armId,
            reward,
            epsilon: Number.isFinite(Number(row.epsilon)) ? Number(row.epsilon) : 0.1,
            updatedAt: nowAt.toISOString()
          });
        }
        const contextSignature = typeof row.contextSignature === 'string' ? row.contextSignature.trim() : '';
        if (row && row.contextualBanditEnabled === true && segmentKey && contextSignature && armId) {
          await contextualBanditRepo.recordBanditReward({
            segmentKey,
            contextSignature,
            armId,
            reward,
            epsilon: Number.isFinite(Number(row.epsilon)) ? Number(row.epsilon) : 0.1,
            updatedAt: nowAt.toISOString()
          });
        }
      }

      summary.updated += 1;
      summary.details.push({
        id: row.id,
        lineUserId: row.lineUserId || null,
        reward,
        signals,
        fromAt: toIso(createdAt),
        toAt: toIso(endAt)
      });
    } catch (err) {
      summary.errors += 1;
      summary.details.push({ id: row.id, reason: 'reward_finalize_error', error: err && err.message ? String(err.message) : 'unknown_error' });
    }
  }

  try {
    await appendAuditLog({
      actor: payload.actor || 'llm_action_reward_job',
      action: 'llm_action_reward_finalize',
      entityType: 'llm_action_logs',
      entityId: 'batch',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        dryRun,
        processed: summary.processed,
        updated: summary.updated,
        skipped: summary.skipped,
        errors: summary.errors,
        rewardWindowHours
      }
    });
  } catch (_err) {
    // best effort
  }

  return summary;
}

module.exports = {
  DEFAULT_REWARD_WINDOW_HOURS,
  DEFAULT_REWARD_WEIGHTS,
  computeReward,
  finalizeLlmActionRewards
};
