'use strict';

const { evaluateGraph } = require('../../domain/journey/taskGraphRules');
const { getTaskDependencyMax } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDependsOn(dependsOn) {
  const rows = Array.isArray(dependsOn) ? dependsOn : [];
  const out = [];
  rows.forEach((item) => {
    const key = normalizeText(item);
    if (!key) return;
    if (out.includes(key)) return;
    out.push(key);
  });
  return out.slice(0, getTaskDependencyMax());
}

function buildEdges(nodes) {
  const rows = Array.isArray(nodes) ? nodes : [];
  const edges = [];
  rows.forEach((node) => {
    const to = normalizeText(node && (node.todoKey || node.taskId));
    if (!to) return;
    normalizeDependsOn(node && node.dependsOn).forEach((from) => {
      edges.push({ from, to });
    });
  });
  return edges;
}

function computeTaskGraph(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const todoItems = Array.isArray(payload.todoItems) ? payload.todoItems : [];
  const evaluated = evaluateGraph(todoItems, {
    nowMs: payload.nowMs
  });
  const warnings = [];
  const dependencyLimit = getTaskDependencyMax();
  todoItems.forEach((item) => {
    const todoKey = normalizeText(item && item.todoKey);
    const dependsOn = Array.isArray(item && item.dependsOn) ? item.dependsOn : [];
    if (dependsOn.length > dependencyLimit) {
      warnings.push(`${todoKey || 'todo'} dependsOn exceeds max ${dependencyLimit}`);
    }
  });
  if (!evaluated.ok) {
    return {
      ok: false,
      evaluatedAt: evaluated.evaluatedAt || new Date().toISOString(),
      nodes: [],
      edges: [],
      topActionableTasks: [],
      cycleCount: Array.isArray(evaluated.cycles) ? evaluated.cycles.length : 0,
      warnings
    };
  }
  const nodes = Array.isArray(evaluated.nodes) ? evaluated.nodes : [];
  return {
    ok: true,
    evaluatedAt: evaluated.evaluatedAt || new Date().toISOString(),
    nodes,
    edges: buildEdges(nodes),
    topActionableTasks: Array.isArray(evaluated.topActionableTasks) ? evaluated.topActionableTasks : [],
    cycleCount: 0,
    warnings
  };
}

module.exports = {
  computeTaskGraph
};

