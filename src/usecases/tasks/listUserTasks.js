'use strict';

const tasksRepo = require('../../repos/firestore/tasksRepo');
const { syncUserTasksProjection } = require('./syncUserTasksProjection');
const { isTaskEngineEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function compareTasks(left, right) {
  const a = left && typeof left === 'object' ? left : {};
  const b = right && typeof right === 'object' ? right : {};
  const dueCompare = toMillis(a.dueAt) - toMillis(b.dueAt);
  if (dueCompare !== 0) return dueCompare;
  return String(a.taskId || '').localeCompare(String(b.taskId || ''), 'ja');
}

async function listUserTasks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const userId = normalizeText(payload.userId || payload.lineUserId);
  if (!userId) throw new Error('userId required');

  if (!isTaskEngineEnabled()) {
    return {
      ok: true,
      engineEnabled: false,
      userId,
      tasks: []
    };
  }

  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  let tasks = await tasksRepository.listTasksByUser({
    userId,
    status: payload.status,
    limit: payload.limit || 200
  });

  if (!tasks.length || payload.forceRefresh === true) {
    const synced = await syncUserTasksProjection(Object.assign({}, payload, {
      userId,
      lineUserId: userId,
      actor: payload.actor || 'task_engine_list'
    }), resolvedDeps);
    tasks = Array.isArray(synced.tasks) ? synced.tasks : [];
  }

  tasks.sort(compareTasks);

  return {
    ok: true,
    userId,
    engineEnabled: true,
    tasks
  };
}

module.exports = {
  listUserTasks
};
