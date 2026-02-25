'use strict';

const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const taskNodesRepo = require('../../repos/firestore/taskNodesRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const {
  evaluateGraph,
  resolveTaskNodeStatus
} = require('../../domain/journey/taskGraphRules');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function appendGraphAudit(action, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const lineUserId = normalizeText(payload.lineUserId) || 'unknown';
  try {
    await appendAuditLog({
      actor: payload.actor || 'journey_task_graph',
      action,
      entityType: 'journey_task_graph',
      entityId: lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: payload.payloadSummary || {}
    });
  } catch (_err) {
    // best effort only
  }
}

async function recomputeJourneyTaskGraph(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  if (!lineUserId) throw new Error('lineUserId required');

  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const nodesRepo = resolvedDeps.taskNodesRepo || taskNodesRepo;
  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();

  const todoItems = Array.isArray(payload.todoItems)
    ? payload.todoItems
    : await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 500 });

  const evaluated = evaluateGraph(todoItems, { nowMs });
  if (!evaluated.ok) {
    await appendGraphAudit('journey_task_graph.cycle_detected', {
      actor: payload.actor || 'journey_task_graph',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      payloadSummary: {
        reason: evaluated.reason,
        cycles: evaluated.cycles || []
      }
    });
    if (payload.failOnCycle !== false) {
      const err = new Error('task_graph_cycle_detected');
      err.code = 'task_graph_cycle_detected';
      throw err;
    }
    return Object.assign({}, evaluated, { lineUserId });
  }

  const patchedNodes = [];
  for (const node of evaluated.nodes) {
    // eslint-disable-next-line no-await-in-loop
    const savedTodo = await todoRepo.patchJourneyTodoItem(lineUserId, node.todoKey, {
      progressState: node.progressState,
      graphStatus: node.graphStatus,
      dependsOn: node.dependsOn,
      blocks: node.blocks,
      priority: node.priority,
      riskLevel: node.riskLevel,
      lockReasons: node.lockReasons,
      graphEvaluatedAt: evaluated.evaluatedAt
    });
    patchedNodes.push(Object.assign({}, node, {
      title: savedTodo && savedTodo.title ? savedTodo.title : node.title,
      status: savedTodo && savedTodo.status ? savedTodo.status : node.status,
      dueAt: savedTodo && savedTodo.dueAt ? savedTodo.dueAt : node.dueAt,
      dueDate: savedTodo && savedTodo.dueDate ? savedTodo.dueDate : node.dueDate
    }));
  }

  const taskNodes = patchedNodes.map((node) => ({
    taskId: node.todoKey,
    todoKey: node.todoKey,
    title: node.title || node.todoKey,
    todoStatus: node.status,
    status: resolveTaskNodeStatus(node),
    progressState: node.progressState,
    graphStatus: node.graphStatus,
    dueAt: node.dueAt,
    dueDate: node.dueDate,
    dependsOn: node.dependsOn,
    blocks: node.blocks,
    lockReasons: node.lockReasons,
    priority: node.priority,
    riskLevel: node.riskLevel,
    riskScore: node.riskScore,
    graphEvaluatedAt: evaluated.evaluatedAt
  }));

  await nodesRepo.upsertTaskNodesBulk(lineUserId, taskNodes, {
    updatedAt: evaluated.evaluatedAt
  });

  const summary = {
    total: patchedNodes.length,
    actionable: patchedNodes.filter((node) => node.graphStatus === 'actionable').length,
    locked: patchedNodes.filter((node) => node.graphStatus === 'locked').length,
    done: patchedNodes.filter((node) => node.graphStatus === 'done').length,
    topActionableTasks: evaluated.topActionableTasks
  };

  await appendGraphAudit('journey_task_graph.recomputed', {
    actor: payload.actor || 'journey_task_graph',
    lineUserId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: Object.assign({
      lineUserId,
      evaluatedAt: evaluated.evaluatedAt
    }, summary)
  });

  return {
    ok: true,
    lineUserId,
    evaluatedAt: evaluated.evaluatedAt,
    nodes: patchedNodes,
    topActionableTasks: evaluated.topActionableTasks,
    summary
  };
}

module.exports = {
  recomputeJourneyTaskGraph
};
