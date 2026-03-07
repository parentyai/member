'use strict';

const { computeNextTasks } = require('../tasks/computeNextTasks');
const { getNextActionCandidates } = require('../phaseLLM3/getNextActionCandidates');
const { isUxosNbaEnabled } = require('../../domain/uxos/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toTaskRecommendation(task) {
  const row = task && typeof task === 'object' ? task : {};
  return {
    action: 'DO_TASK',
    reason: 'task_engine_candidate',
    confidence: 0.8,
    task: {
      taskId: row.taskId || null,
      ruleId: row.ruleId || null,
      title: row.title || null,
      category: row.category || null,
      dueAt: row.dueAt || null,
      rank: Number.isFinite(Number(row.rank)) ? Number(row.rank) : null
    }
  };
}

function toLlmRecommendation(candidate) {
  const item = candidate && typeof candidate === 'object' ? candidate : {};
  const safety = item.safety && typeof item.safety === 'object' ? item.safety : {};
  return {
    action: typeof item.action === 'string' ? item.action : 'NO_ACTION',
    reason: typeof item.reason === 'string' ? item.reason : 'llm_candidate',
    confidence: Number.isFinite(Number(item.confidence)) ? Number(item.confidence) : 0,
    safety: {
      status: safety.status === 'BLOCK' ? 'BLOCK' : 'OK',
      reasons: Array.isArray(safety.reasons) ? safety.reasons : []
    }
  };
}

async function getNextBestAction(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');

  if (!isUxosNbaEnabled()) {
    return {
      ok: true,
      enabled: false,
      lineUserId,
      source: 'disabled',
      recommendation: null
    };
  }

  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const now = payload.now || new Date().toISOString();
  const actor = normalizeText(payload.actor) || 'uxos_next_best_action';
  const traceId = normalizeText(payload.traceId) || null;
  const requestId = normalizeText(payload.requestId) || null;

  const taskResult = await computeNextTasks({
    lineUserId,
    limit: 1,
    actor,
    now
  }, resolvedDeps).catch(() => null);
  const topTask = taskResult
    && Array.isArray(taskResult.tasks)
    && taskResult.tasks.length > 0
    ? taskResult.tasks[0]
    : null;
  if (topTask) {
    return {
      ok: true,
      enabled: true,
      lineUserId,
      source: 'task_engine',
      recommendation: toTaskRecommendation(topTask),
      debug: {
        engineEnabled: taskResult.engineEnabled === true,
        totalCandidates: Number.isFinite(Number(taskResult.totalCandidates))
          ? Number(taskResult.totalCandidates)
          : null
      }
    };
  }

  const llmResult = await getNextActionCandidates({
    lineUserId,
    actor,
    traceId,
    requestId
  }, resolvedDeps).catch(() => null);
  const topLlmCandidate = llmResult
    && Array.isArray(llmResult.candidates)
    && llmResult.candidates.length > 0
    ? llmResult.candidates[0]
    : null;
  if (topLlmCandidate) {
    return {
      ok: true,
      enabled: true,
      lineUserId,
      source: 'llm_next_actions',
      recommendation: toLlmRecommendation(topLlmCandidate),
      debug: {
        llmStatus: llmResult.llmStatus || null,
        llmUsed: llmResult.llmUsed === true
      }
    };
  }

  return {
    ok: true,
    enabled: true,
    lineUserId,
    source: 'fallback',
    recommendation: {
      action: 'NO_ACTION',
      reason: 'no_candidate_available',
      confidence: 0
    }
  };
}

module.exports = {
  getNextBestAction
};
