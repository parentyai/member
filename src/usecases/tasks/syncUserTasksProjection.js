'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { computeUserTasks } = require('./computeUserTasks');
const { toJourneyPatchFromTaskStatus } = require('../../domain/tasks/statusMapping');
const { recomputeJourneyTaskGraph } = require('../journey/recomputeJourneyTaskGraph');
const { isTaskEngineEnabled } = require('../../domain/tasks/featureFlags');
const { appendTaskEventIfStateChanged } = require('./recordTaskEvent');
const { USER_SCENARIO_FIELD } = require('../../domain/constants');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveMeaning(task) {
  const row = task && typeof task === 'object' ? task : {};
  const meaning = row.meaning && typeof row.meaning === 'object' ? row.meaning : null;
  if (!meaning) return null;
  const meaningKey = normalizeText(meaning.meaningKey) || normalizeText(row.stepKey) || null;
  const title = normalizeText(meaning.title) || null;
  const summary = normalizeText(meaning.summary) || null;
  const doneDefinition = normalizeText(meaning.doneDefinition) || null;
  const whyNow = normalizeText(meaning.whyNow) || null;
  const helpLinkRegistryIds = Array.isArray(meaning.helpLinkRegistryIds)
    ? meaning.helpLinkRegistryIds.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];
  const opsNotes = normalizeText(meaning.opsNotes) || null;
  if (!meaningKey && !title && !summary && !doneDefinition && !whyNow && !helpLinkRegistryIds.length && !opsNotes) {
    return null;
  }
  return {
    meaningKey: meaningKey || normalizeText(row.stepKey) || null,
    title,
    summary,
    doneDefinition,
    whyNow,
    helpLinkRegistryIds,
    opsNotes
  };
}

function buildJourneyTodoPatch(task) {
  const row = task && typeof task === 'object' ? task : {};
  const mapped = toJourneyPatchFromTaskStatus(row.status, row.blockedReason);
  const meaning = resolveMeaning(row);
  return Object.assign({}, mapped, {
    todoKey: row.ruleId,
    title: (meaning && meaning.title) || row.ruleId,
    meaningKey: (meaning && meaning.meaningKey) || normalizeText(row.stepKey) || null,
    meaning: meaning || null,
    whyNow: meaning && meaning.whyNow ? meaning.whyNow : null,
    doneDefinition: meaning && meaning.doneDefinition ? meaning.doneDefinition : null,
    [USER_SCENARIO_FIELD]: row && row[USER_SCENARIO_FIELD] || null,
    dueAt: row.dueAt || null,
    dueDate: row.dueAt ? String(row.dueAt).slice(0, 10) : null,
    nextReminderAt: row.nextNudgeAt || null,
    snoozeUntil: row.status === 'snoozed' ? row.nextNudgeAt : null,
    stateEvidenceRef: row.taskId || null,
    stateUpdatedAt: row.checkedAt || new Date().toISOString(),
    sourceTemplateVersion: 'task_engine_v1'
  });
}

async function syncUserTasksProjection(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const userId = normalizeText(payload.userId || payload.lineUserId);
  if (!userId) throw new Error('userId required');

  if (!isTaskEngineEnabled()) {
    return {
      ok: true,
      engineEnabled: false,
      userId,
      now: new Date().toISOString(),
      syncedTaskCount: 0,
      syncedTodoCount: 0,
      tasks: [],
      nextActions: [],
      blocked: [],
      explain: []
    };
  }

  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const todoRepository = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  const beforeList = await tasksRepository.listTasksByUser({
    userId,
    limit: 1000
  }).catch(() => []);
  const beforeByTaskId = new Map(
    (Array.isArray(beforeList) ? beforeList : [])
      .filter((task) => task && task.taskId)
      .map((task) => [task.taskId, task])
  );

  const computed = payload.computed && typeof payload.computed === 'object'
    ? payload.computed
    : await computeUserTasks(Object.assign({}, payload, { userId }), resolvedDeps);

  const tasks = Array.isArray(computed.tasks) ? computed.tasks : [];
  const computedByTaskId = new Map(
    tasks
      .filter((task) => task && task.taskId)
      .map((task) => [task.taskId, task])
  );
  const saved = await tasksRepository.upsertTasksBulk(tasks);

  let syncedTodoCount = 0;
  for (const task of tasks) {
    const todoKey = normalizeText(task && task.ruleId);
    if (!todoKey) continue;
    const patch = buildJourneyTodoPatch(task);
    // eslint-disable-next-line no-await-in-loop
    await todoRepository.upsertJourneyTodoItem(userId, todoKey, patch);
    syncedTodoCount += 1;
  }

  for (const afterTask of saved) {
    const beforeTask = beforeByTaskId.get(afterTask && afterTask.taskId);
    const computedTask = computedByTaskId.get(afterTask && afterTask.taskId);
    // eslint-disable-next-line no-await-in-loop
    await appendTaskEventIfStateChanged({
      beforeTask,
      afterTask,
      checkedAt: afterTask && afterTask.checkedAt,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      actor: payload.actor || 'task_engine_sync',
      source: 'sync_user_tasks_projection',
      explainKeys: Array.isArray(computedTask && computedTask.explain)
        ? computedTask.explain
          .map((entry) => entry && entry.decisionKey)
          .filter(Boolean)
        : []
    }, resolvedDeps).catch(() => null);
  }

  await recomputeJourneyTaskGraph({
    lineUserId: userId,
    actor: payload.actor || 'task_engine_sync',
    failOnCycle: false
  }, resolvedDeps).catch(() => null);

  return {
    ok: true,
    engineEnabled: true,
    userId,
    now: computed.now,
    syncedTaskCount: saved.length,
    syncedTodoCount,
    tasks: saved,
    nextActions: computed.nextActions || [],
    blocked: computed.blocked || [],
    explain: computed.explain || []
  };
}

module.exports = {
  syncUserTasksProjection
};
