'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { TASK_STATUS } = require('../../domain/tasks/constants');
const { normalizeTaskStatus, toJourneyPatchFromTaskStatus } = require('../../domain/tasks/statusMapping');
const { recomputeJourneyTaskGraph } = require('../journey/recomputeJourneyTaskGraph');
const { appendTaskEventIfStateChanged } = require('./recordTaskEvent');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString();
}

function resolveTargetStatus(payload, currentTask) {
  const action = normalizeText(payload.action).toLowerCase();
  if (action === 'complete' || action === 'done') return TASK_STATUS.DONE;
  if (action === 'doing' || action === 'in_progress') return TASK_STATUS.DOING;
  if (action === 'todo' || action === 'not_started') return TASK_STATUS.TODO;
  if (action === 'snooze') return TASK_STATUS.SNOOZED;
  return normalizeTaskStatus(payload.status, currentTask && currentTask.status ? currentTask.status : TASK_STATUS.TODO);
}

async function patchTaskState(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};

  const userId = normalizeText(payload.userId || payload.lineUserId);
  const taskId = normalizeText(payload.taskId);
  if (!userId) throw new Error('userId required');
  if (!taskId) throw new Error('taskId required');

  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const todoRepository = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  const currentTask = await tasksRepository.getTask(taskId);
  if (!currentTask) throw new Error('task not found');
  if (currentTask.userId !== userId && currentTask.lineUserId !== userId) {
    throw new Error('task user mismatch');
  }

  const status = resolveTargetStatus(payload, currentTask);
  const nowIso = payload.now || new Date().toISOString();
  const snoozeUntil = toIso(payload.snoozeUntil || payload.nextNudgeAt);

  const patch = {
    status,
    checkedAt: nowIso,
    blockedReason: status === TASK_STATUS.BLOCKED ? (payload.blockedReason || currentTask.blockedReason || 'manual_blocked') : null,
    nextNudgeAt: status === TASK_STATUS.SNOOZED
      ? (snoozeUntil || currentTask.nextNudgeAt || nowIso)
      : (status === TASK_STATUS.DONE ? null : (payload.nextNudgeAt || currentTask.nextNudgeAt || currentTask.dueAt || nowIso)),
    updatedAt: nowIso
  };

  if (status === TASK_STATUS.DONE) {
    patch.lastNotifiedAt = currentTask.lastNotifiedAt || null;
  }

  const updatedTask = await tasksRepository.patchTask(taskId, patch);

  const todoKey = normalizeText(updatedTask && updatedTask.ruleId);
  if (todoKey) {
    const todoPatch = Object.assign({}, toJourneyPatchFromTaskStatus(status, patch.blockedReason), {
      dueAt: updatedTask.dueAt || null,
      dueDate: updatedTask.dueAt ? String(updatedTask.dueAt).slice(0, 10) : null,
      nextReminderAt: updatedTask.nextNudgeAt || null,
      snoozeUntil: status === TASK_STATUS.SNOOZED ? updatedTask.nextNudgeAt : null,
      stateEvidenceRef: updatedTask.taskId,
      stateUpdatedAt: nowIso
    });
    await todoRepository.upsertJourneyTodoItem(userId, todoKey, todoPatch);
  }

  await recomputeJourneyTaskGraph({
    lineUserId: userId,
    actor: payload.actor || 'task_engine_patch',
    failOnCycle: false
  }, resolvedDeps).catch(() => null);

  await appendTaskEventIfStateChanged({
    beforeTask: currentTask,
    afterTask: updatedTask,
    checkedAt: nowIso,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    actor: payload.actor || 'task_engine_patch',
    source: 'patch_task_state'
  }, resolvedDeps).catch(() => null);

  return {
    ok: true,
    userId,
    task: updatedTask
  };
}

module.exports = {
  patchTaskState
};
