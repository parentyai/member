'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeForMatch(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, '');
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
        key: normalizeText(item.key || item.todoKey || item.taskKey || item.id),
        title: normalizeText(item.title || item.label || item.summary),
        status: normalizeText(item.status || item.graphStatus || item.progressState).toLowerCase() || null
      };
    })
    .filter(Boolean)
    .slice(0, 5);
}

function collectTaskLabels(blockedTask, tasks) {
  const labels = [];
  const pushLabel = (value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    if (!labels.includes(normalized)) labels.push(normalized);
  };
  const row = blockedTask && typeof blockedTask === 'object' ? blockedTask : null;
  pushLabel(row && (row.key || row.todoKey || row.taskKey || row.id));
  pushLabel(row && (row.title || row.label || row.summary));
  tasks.forEach((item) => {
    pushLabel(item.key);
    pushLabel(item.title);
  });
  return labels
    .map((item) => normalizeForMatch(item))
    .filter((item) => item.length >= 3)
    .slice(0, 10);
}

function normalizeNextActions(values) {
  const rows = Array.isArray(values) ? values : [];
  return rows
    .map((item) => normalizeText(item))
    .filter(Boolean)
    .slice(0, 3);
}

function resolveJourneyActionSignals(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const snapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const tasks = normalizeTasks(snapshot);
  const blockedTask = payload.blockedTask && typeof payload.blockedTask === 'object'
    ? payload.blockedTask
    : tasks.find((item) => item.status === 'locked' || item.status === 'blocked') || null;
  const journeyPhase = normalizeText(payload.journeyPhase)
    || normalizeText(snapshot && (snapshot.journeyPhase || snapshot.phase))
    || null;
  const nextActions = normalizeNextActions(payload.nextActions);
  const taskBlockerDetected = payload.taskBlockerDetected === true || Boolean(blockedTask);
  const explicitAlignment = typeof payload.journeyAlignedAction === 'boolean'
    ? payload.journeyAlignedAction
    : null;
  let journeyAlignedAction = explicitAlignment;
  if (journeyAlignedAction === null) {
    journeyAlignedAction = true;
    if (taskBlockerDetected && nextActions.length) {
      const blockedLabels = collectTaskLabels(blockedTask, tasks);
      if (blockedLabels.length) {
        journeyAlignedAction = nextActions.some((item) => {
          const actionText = normalizeForMatch(item);
          return blockedLabels.some((label) => actionText.includes(label));
        });
      }
    }
  }

  return {
    journeyContext: Boolean(snapshot) || Boolean(journeyPhase) || taskBlockerDetected,
    journeyPhase: journeyPhase ? journeyPhase.toLowerCase() : null,
    taskBlockerDetected,
    journeyAlignedAction,
    blockedTask,
    nextActions
  };
}

module.exports = {
  resolveJourneyActionSignals
};
