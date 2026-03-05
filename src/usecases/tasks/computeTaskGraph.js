'use strict';

const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { evaluateGraph } = require('../../domain/journey/taskGraphRules');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function computeTaskGraph(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const todoItems = Array.isArray(payload.todoItems)
    ? payload.todoItems
    : await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 500 }).catch(() => []);
  const graph = evaluateGraph(todoItems, { nowMs: Date.now() });
  return {
    ok: graph && graph.ok === true,
    lineUserId,
    evaluatedAt: graph && graph.evaluatedAt ? graph.evaluatedAt : new Date().toISOString(),
    cycleCount: graph && Array.isArray(graph.cycles) ? graph.cycles.length : 0,
    warningCount: graph && Array.isArray(graph.warnings) ? graph.warnings.length : 0,
    nodes: graph && Array.isArray(graph.nodes) ? graph.nodes : [],
    edges: graph && Array.isArray(graph.nodes)
      ? graph.nodes.flatMap((node) => (Array.isArray(node.dependsOn) ? node.dependsOn.map((dep) => ({ from: dep, to: node.todoKey })) : []))
      : [],
    topActionableTasks: graph && Array.isArray(graph.topActionableTasks) ? graph.topActionableTasks : [],
    warnings: graph && Array.isArray(graph.warnings) ? graph.warnings : [],
    cycles: graph && Array.isArray(graph.cycles) ? graph.cycles : []
  };
}

module.exports = {
  computeTaskGraph
};
