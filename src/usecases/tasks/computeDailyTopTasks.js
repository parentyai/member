'use strict';

function normalizeNumber(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function toMillis(value, fallback) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

function computePriorityComponent(priorityScore) {
  const raw = normalizeNumber(priorityScore, 100);
  const bounded = Math.max(0, Math.min(1000, Math.floor(raw)));
  // lower numeric priority means higher urgency in existing task-rules.
  return 1000 - bounded;
}

function computeDeadlineComponent(dueAt, nowMs) {
  const dueMs = toMillis(dueAt, Number.NaN);
  if (!Number.isFinite(dueMs)) return 0;
  const diffDays = Math.floor((dueMs - nowMs) / (24 * 60 * 60 * 1000));
  if (diffDays <= 0) return 500;
  return Math.max(0, 300 - (diffDays * 15));
}

function computeDependencyComponent(taskLike) {
  const row = taskLike && typeof taskLike === 'object' ? taskLike : {};
  if (row.blockedReason) return -400;
  if (row.status === 'doing') return 120;
  return 40;
}

function computeAttentionScore(taskLike, nowMs) {
  const row = taskLike && typeof taskLike === 'object' ? taskLike : {};
  const priorityComponent = computePriorityComponent(row.priorityScore);
  const deadlineComponent = computeDeadlineComponent(row.dueAt, nowMs);
  const dependencyComponent = computeDependencyComponent(row);
  return {
    priorityComponent,
    deadlineComponent,
    dependencyComponent,
    score: priorityComponent + deadlineComponent + dependencyComponent
  };
}

function computeDailyTopTasks(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const rows = Array.isArray(payload.tasks) ? payload.tasks : [];
  const limit = Number.isFinite(Number(payload.limit))
    ? Math.max(1, Math.floor(Number(payload.limit)))
    : 3;
  const nowMs = toMillis(payload.now || new Date().toISOString(), Date.now());
  const scored = rows.map((task, index) => {
    const score = computeAttentionScore(task, nowMs);
    return Object.assign({}, task, score, { _index: index });
  });
  scored.sort((left, right) => {
    const scoreCompare = Number(right.score || 0) - Number(left.score || 0);
    if (scoreCompare !== 0) return scoreCompare;
    const dueCompare = toMillis(left.dueAt, Number.MAX_SAFE_INTEGER) - toMillis(right.dueAt, Number.MAX_SAFE_INTEGER);
    if (dueCompare !== 0) return dueCompare;
    return Number(left._index || 0) - Number(right._index || 0);
  });
  return scored.slice(0, limit).map((row) => {
    const out = Object.assign({}, row);
    delete out._index;
    return out;
  });
}

module.exports = {
  computeDailyTopTasks,
  computeAttentionScore
};
