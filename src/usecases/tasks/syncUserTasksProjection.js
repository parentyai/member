'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { computeUserTasks } = require('./computeUserTasks');
const { toJourneyPatchFromTaskStatus } = require('../../domain/tasks/statusMapping');
const { recomputeJourneyTaskGraph } = require('../journey/recomputeJourneyTaskGraph');
const { isTaskEngineEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildJourneyTodoPatch(task) {
  const row = task && typeof task === 'object' ? task : {};
  const mapped = toJourneyPatchFromTaskStatus(row.status, row.blockedReason);
  return Object.assign({}, mapped, {
    todoKey: row.ruleId,
    title: row.ruleId,
    scenarioKey: row.scenarioKey || null,
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

  const computed = payload.computed && typeof payload.computed === 'object'
    ? payload.computed
    : await computeUserTasks(Object.assign({}, payload, { userId }), resolvedDeps);

  const tasks = Array.isArray(computed.tasks) ? computed.tasks : [];
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
