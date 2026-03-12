'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function normalizeTasks(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const rows = Array.isArray(source.topTasks)
    ? source.topTasks
    : (Array.isArray(source.topOpenTasks)
      ? source.topOpenTasks
      : (Array.isArray(source.openTasksTop5) ? source.openTasksTop5 : []));
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      return {
        key: normalizeText(item.key || item.taskKey).toLowerCase() || null,
        title: normalizeText(item.title || item.label) || null,
        status: normalizeText(item.status).toLowerCase() || null
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function resolveJourneyGroundingContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const snapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const tasks = normalizeTasks(snapshot);
  const blockedTask = payload.blockedTask && typeof payload.blockedTask === 'object'
    ? payload.blockedTask
    : tasks.find((item) => item.status === 'locked') || null;
  const phase = normalizeText(payload.journeyPhase)
    || normalizeText(payload.journeyContext && payload.journeyContext.phase)
    || normalizeText(snapshot && (snapshot.journeyPhase || snapshot.phase))
    || null;
  const taskBlockerDetected = payload.taskBlockerDetected === true
    || payload.taskBlockerContext === true
    || Boolean(blockedTask);
  const journeyAlignedAction = typeof payload.journeyAlignedAction === 'boolean'
    ? payload.journeyAlignedAction
    : true;
  const reasonCodes = normalizeReasonCodes(payload.journeyReasonCodes);
  const active = payload.journeyContext === true || Boolean(phase) || taskBlockerDetected;
  if (active && !reasonCodes.includes('journey_context_active')) reasonCodes.push('journey_context_active');
  if (taskBlockerDetected && !reasonCodes.includes('task_blocker_detected')) reasonCodes.push('task_blocker_detected');
  if (taskBlockerDetected && journeyAlignedAction === false && !reasonCodes.includes('journey_task_conflict')) {
    reasonCodes.push('journey_task_conflict');
  }
  return {
    active,
    phase: phase ? phase.toLowerCase() : null,
    taskBlockerDetected,
    journeyAlignedAction,
    blockedTask,
    reasonCodes: normalizeReasonCodes(reasonCodes)
  };
}

module.exports = {
  resolveJourneyGroundingContext
};
