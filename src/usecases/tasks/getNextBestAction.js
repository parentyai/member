'use strict';

const { computeNextTasks } = require('./computeNextTasks');
const { isUxOsNbaEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function buildTaskView(task) {
  const row = task && typeof task === 'object' ? task : {};
  return {
    taskId: normalizeText(row.taskId) || null,
    ruleId: normalizeText(row.ruleId) || null,
    title: normalizeText(row.title) || null,
    status: normalizeText(row.status) || null,
    category: normalizeText(row.category) || null,
    rank: toNumber(row.rank, null),
    priorityScore: toNumber(row.priorityScore, null),
    dueAt: normalizeText(row.dueAt) || null,
    cityPackPriorityBoost: toNumber(row.cityPackPriorityBoost, 0)
  };
}

function selectNextTask(tasks) {
  if (!Array.isArray(tasks) || tasks.length === 0) return null;
  return buildTaskView(tasks[0]);
}

async function getNextBestAction(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const compute = typeof resolvedDeps.computeNextTasks === 'function'
    ? resolvedDeps.computeNextTasks
    : computeNextTasks;

  if (!isUxOsNbaEnabled()) {
    return {
      ok: true,
      enabled: false,
      authority: 'compute_next_tasks',
      lineUserId,
      nextBestAction: null,
      fallbackReason: 'ENABLE_UXOS_NBA_V1_off',
      totalCandidates: 0
    };
  }

  let computed;
  try {
    computed = await compute({
      lineUserId,
      userId: lineUserId,
      limit: payload.limit || 3,
      category: payload.category || null,
      now: payload.now || null,
      actor: payload.actor || 'uxos_nba_adapter'
    }, resolvedDeps);
  } catch (_err) {
    return {
      ok: true,
      enabled: true,
      authority: 'compute_next_tasks',
      lineUserId,
      nextBestAction: null,
      fallbackReason: 'task_engine_error',
      totalCandidates: 0
    };
  }

  const tasks = Array.isArray(computed && computed.tasks) ? computed.tasks : [];
  const topTask = selectNextTask(tasks);
  return {
    ok: true,
    enabled: true,
    authority: 'compute_next_tasks',
    lineUserId,
    nextBestAction: topTask,
    fallbackReason: topTask ? null : 'no_candidate',
    totalCandidates: Number.isFinite(Number(computed && computed.totalCandidates))
      ? Number(computed.totalCandidates)
      : tasks.length
  };
}

module.exports = {
  getNextBestAction
};
