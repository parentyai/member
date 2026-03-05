'use strict';

const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { listUserTasks } = require('./listUserTasks');
const { computeTaskGraph } = require('./computeTaskGraph');
const { getJourneyNextTaskMax } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  const parsed = Date.parse(value || '');
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

async function loadRulePriorityMap(ruleIds, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const map = new Map();
  const ids = Array.from(new Set((Array.isArray(ruleIds) ? ruleIds : []).map((item) => normalizeText(item)).filter(Boolean)));
  for (const ruleId of ids) {
    // eslint-disable-next-line no-await-in-loop
    const rule = await repo.getStepRule(ruleId).catch(() => null);
    if (rule) {
      map.set(ruleId, {
        priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 0,
        category: rule.category || null
      });
    }
  }
  return map;
}

async function computeNextTasks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');
  const limit = Number.isFinite(Number(payload.limit))
    ? Math.max(1, Math.min(10, Math.floor(Number(payload.limit))))
    : getJourneyNextTaskMax();

  const taskResult = await listUserTasks({
    userId: lineUserId,
    lineUserId,
    forceRefresh: payload.forceRefresh !== false,
    actor: payload.actor || 'compute_next_tasks'
  }, resolvedDeps);
  const tasks = Array.isArray(taskResult.tasks) ? taskResult.tasks : [];
  const activeTasks = tasks.filter((task) => ['todo', 'doing'].includes(String(task.status || '').toLowerCase()));

  const [priorityMap, todoItems] = await Promise.all([
    loadRulePriorityMap(activeTasks.map((task) => task.ruleId), resolvedDeps),
    (resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo).listJourneyTodoItemsByLineUserId({
      lineUserId,
      limit: 500
    }).catch(() => [])
  ]);

  const graph = await computeTaskGraph({
    lineUserId,
    todoItems: Array.isArray(todoItems) ? todoItems : []
  }, resolvedDeps);
  const rankMap = new Map();
  if (graph && graph.ok && Array.isArray(graph.topActionableTasks)) {
    graph.topActionableTasks.forEach((item, index) => {
      if (item && item.todoKey) rankMap.set(item.todoKey, index + 1);
    });
  }

  const sorted = activeTasks
    .map((task) => {
      const meta = priorityMap.get(task.ruleId) || { priority: 0, category: null };
      return {
        task,
        priority: meta.priority,
        category: meta.category,
        graphRank: rankMap.has(task.ruleId) ? rankMap.get(task.ruleId) : Number.MAX_SAFE_INTEGER
      };
    })
    .sort((left, right) => {
      if (left.graphRank !== right.graphRank) return left.graphRank - right.graphRank;
      if (left.priority !== right.priority) return right.priority - left.priority;
      return toMillis(left.task.dueAt) - toMillis(right.task.dueAt);
    })
    .slice(0, limit);

  return {
    ok: true,
    lineUserId,
    limit,
    tasks: sorted.map((item) => Object.assign({}, item.task, {
      category: item.category
    })),
    graphOk: graph && graph.ok === true,
    cycleCount: graph && Array.isArray(graph.cycles) ? graph.cycles.length : 0
  };
}

module.exports = {
  computeNextTasks
};
