'use strict';

const TASK_NODE_STATUS = Object.freeze(['not_started', 'in_progress', 'done', 'locked']);
const PROGRESS_STATES = Object.freeze(['not_started', 'in_progress']);
const GRAPH_STATES = Object.freeze(['actionable', 'locked', 'done']);
const RISK_LEVELS = Object.freeze(['low', 'medium', 'high']);
const JOURNEY_STATES = Object.freeze(['planned', 'in_progress', 'done', 'blocked', 'snoozed', 'skipped']);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((value) => {
    const normalized = normalizeText(value);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizePriority(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 3;
  return Math.max(1, Math.min(5, Math.floor(parsed)));
}

function normalizeRiskLevel(value) {
  const normalized = normalizeText(value).toLowerCase();
  return RISK_LEVELS.includes(normalized) ? normalized : 'medium';
}

function normalizeProgressState(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (PROGRESS_STATES.includes(normalized)) return normalized;
  return 'not_started';
}

function normalizeGraphState(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (GRAPH_STATES.includes(normalized)) return normalized;
  return 'actionable';
}

function normalizeJourneyState(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (JOURNEY_STATES.includes(normalized)) return normalized;
  return 'planned';
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? value : value * 1000;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function toIso(value) {
  const ms = toMillis(value);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

function isSnoozed(node, nowMs) {
  const snoozeAt = toMillis(node && node.snoozeUntil);
  if (!Number.isFinite(snoozeAt)) return false;
  return snoozeAt > nowMs;
}

function normalizeTodoStatus(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'completed' || normalized === 'skipped' || normalized === 'open') return normalized;
  return 'open';
}

function isTodoDone(todo) {
  const status = normalizeTodoStatus(todo && todo.status);
  if (status === 'completed' || status === 'skipped') return true;
  const graphStatus = normalizeGraphState(todo && todo.graphStatus);
  return graphStatus === 'done';
}

function normalizeNode(item) {
  const payload = item && typeof item === 'object' ? item : {};
  const todoKey = normalizeText(payload.todoKey || payload.taskId);
  const status = normalizeTodoStatus(payload.status);
  const progressState = normalizeProgressState(payload.progressState);
  const graphStatus = normalizeGraphState(payload.graphStatus);
  const journeyState = normalizeJourneyState(payload.journeyState);
  const dueAt = toIso(payload.dueAt || payload.dueDate || payload.due);
  const snoozeUntil = toIso(payload.snoozeUntil);
  const dependsOn = normalizeArray(payload.dependsOn || payload.depends_on);
  const blocks = normalizeArray(payload.blocks);
  const lockReasons = normalizeArray(payload.lockReasons);
  const dependencyReasonMap = payload.dependencyReasonMap && typeof payload.dependencyReasonMap === 'object' && !Array.isArray(payload.dependencyReasonMap)
    ? payload.dependencyReasonMap
    : {};
  return {
    todoKey,
    title: normalizeText(payload.title),
    status,
    progressState,
    graphStatus,
    journeyState,
    dueAt,
    dueDate: dueAt ? dueAt.slice(0, 10) : null,
    snoozeUntil,
    dependsOn,
    blocks,
    priority: normalizePriority(payload.priority),
    riskLevel: normalizeRiskLevel(payload.riskLevel),
    lockReasons,
    dependencyReasonMap,
    riskScore: 0
  };
}

function buildNodeMap(todoItems) {
  const out = new Map();
  (Array.isArray(todoItems) ? todoItems : []).forEach((item) => {
    const node = normalizeNode(item);
    if (!node.todoKey) return;
    out.set(node.todoKey, node);
  });
  return out;
}

function buildReverseBlocks(nodeMap) {
  const out = new Map();
  Array.from(nodeMap.values()).forEach((node) => {
    if (!out.has(node.todoKey)) out.set(node.todoKey, new Set(node.blocks));
    node.dependsOn.forEach((dep) => {
      if (!nodeMap.has(dep)) return;
      if (!out.has(dep)) out.set(dep, new Set());
      out.get(dep).add(node.todoKey);
    });
  });
  return out;
}

function detectCycles(nodeMap) {
  const visited = new Set();
  const onStack = new Set();
  const path = [];
  const cycles = [];

  function visit(nodeKey) {
    if (onStack.has(nodeKey)) {
      const idx = path.indexOf(nodeKey);
      const cycle = idx >= 0 ? path.slice(idx).concat(nodeKey) : [nodeKey, nodeKey];
      const marker = cycle.join('>');
      if (!cycles.some((item) => item.join('>') === marker)) cycles.push(cycle);
      return;
    }
    if (visited.has(nodeKey)) return;
    visited.add(nodeKey);
    onStack.add(nodeKey);
    path.push(nodeKey);

    const node = nodeMap.get(nodeKey);
    const deps = node && Array.isArray(node.dependsOn) ? node.dependsOn : [];
    deps.forEach((dep) => {
      if (!nodeMap.has(dep)) return;
      visit(dep);
    });

    path.pop();
    onStack.delete(nodeKey);
  }

  Array.from(nodeMap.keys()).forEach((nodeKey) => visit(nodeKey));
  return cycles;
}

function computeDueUrgency(dueAt, nowMs) {
  const dueMs = toMillis(dueAt);
  if (!Number.isFinite(dueMs)) return 0;
  const diff = dueMs - nowMs;
  if (diff <= 0) return 100;
  const oneDay = 24 * 60 * 60 * 1000;
  if (diff <= oneDay) return 85;
  if (diff <= oneDay * 3) return 70;
  if (diff <= oneDay * 7) return 50;
  if (diff <= oneDay * 14) return 30;
  return 10;
}

function riskLevelWeight(level) {
  if (level === 'high') return 25;
  if (level === 'medium') return 12;
  return 4;
}

function computeRiskScore(node, blockedImpact, nowMs) {
  const dueUrgency = computeDueUrgency(node.dueAt, nowMs);
  const priorityWeight = normalizePriority(node.priority) * 10;
  const levelWeight = riskLevelWeight(normalizeRiskLevel(node.riskLevel));
  const blockedWeight = Math.max(0, blockedImpact) * 6;
  return dueUrgency + priorityWeight + levelWeight + blockedWeight;
}

function evaluateGraph(todoItems, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const nowMs = Number.isFinite(Number(opts.nowMs)) ? Number(opts.nowMs) : Date.now();
  const evaluatedAt = new Date(nowMs).toISOString();

  const nodeMap = buildNodeMap(todoItems);
  const cycles = detectCycles(nodeMap);
  if (cycles.length > 0) {
    return {
      ok: false,
      reason: 'cycle_detected',
      evaluatedAt,
      cycles,
      nodes: [],
      topActionableTasks: []
    };
  }

  const reverseBlocks = buildReverseBlocks(nodeMap);
  const nodes = Array.from(nodeMap.values()).map((node) => {
    const next = Object.assign({}, node);
    const done = isTodoDone(next);
    const snoozed = isSnoozed(next, nowMs);
    if (done) {
      next.graphStatus = 'done';
      next.lockReasons = [];
      next.journeyState = next.status === 'skipped' ? 'skipped' : 'done';
    } else {
      const lockReasons = [];
      const unresolvedDeps = [];
      const unresolvedDepsWithReason = [];
      next.dependsOn.forEach((depKey) => {
        const dep = nodeMap.get(depKey);
        if (!dep) {
          lockReasons.push(`依存タスク未登録:${depKey}`);
          unresolvedDepsWithReason.push({
            todoKey: depKey,
            reasonType: 'prerequisite',
            reasonLabel: '依存タスク未登録'
          });
          return;
        }
        if (!isTodoDone(dep)) {
          unresolvedDeps.push(depKey);
          const depReason = next.dependencyReasonMap && typeof next.dependencyReasonMap[depKey] === 'string'
            ? normalizeText(next.dependencyReasonMap[depKey])
            : '';
          unresolvedDepsWithReason.push({
            todoKey: depKey,
            reasonType: depReason || 'prerequisite',
            reasonLabel: depReason || null
          });
        }
      });
      if (unresolvedDeps.length > 0) {
        lockReasons.push(`依存未完了:${unresolvedDeps.join(',')}`);
      }
      next.graphStatus = lockReasons.length > 0 ? 'locked' : 'actionable';
      next.lockReasons = lockReasons;
      next.unresolvedDependsOn = unresolvedDepsWithReason;
      if (snoozed) {
        next.journeyState = 'snoozed';
      } else if (next.graphStatus === 'locked') {
        next.journeyState = 'blocked';
      } else if (next.progressState === 'in_progress') {
        next.journeyState = 'in_progress';
      } else {
        next.journeyState = 'planned';
      }
    }

    const blockedBy = reverseBlocks.get(next.todoKey);
    const blockedImpact = blockedBy instanceof Set ? blockedBy.size : 0;
    next.blocks = blockedBy instanceof Set ? Array.from(blockedBy.values()) : [];
    next.riskScore = computeRiskScore(next, blockedImpact, nowMs);
    if (next.graphStatus === 'done') next.riskScore = 0;
    return next;
  });

  const topActionableTasks = nodes
    .filter((node) => node.graphStatus === 'actionable' && normalizeTodoStatus(node.status) === 'open')
    .sort((a, b) => {
      if (a.riskScore !== b.riskScore) return b.riskScore - a.riskScore;
      const dueA = toMillis(a.dueAt);
      const dueB = toMillis(b.dueAt);
      if (Number.isFinite(dueA) && Number.isFinite(dueB) && dueA !== dueB) return dueA - dueB;
      return a.todoKey.localeCompare(b.todoKey, 'ja');
    })
    .slice(0, 3)
    .map((node) => ({
      todoKey: node.todoKey,
      title: node.title || node.todoKey,
      dueAt: node.dueAt,
      dueDate: node.dueDate,
      priority: node.priority,
      riskLevel: node.riskLevel,
      riskScore: node.riskScore,
      journeyState: node.journeyState,
      dependsOn: node.dependsOn,
      blocks: node.blocks
    }));

  return {
    ok: true,
    evaluatedAt,
    cycles: [],
    nodes,
    topActionableTasks
  };
}

function resolveTaskNodeStatus(node) {
  const payload = node && typeof node === 'object' ? node : {};
  if (payload.journeyState === 'snoozed') return 'locked';
  if (payload.graphStatus === 'done') return 'done';
  if (payload.graphStatus === 'locked') return 'locked';
  return payload.progressState === 'in_progress' ? 'in_progress' : 'not_started';
}

module.exports = {
  TASK_NODE_STATUS,
  PROGRESS_STATES,
  GRAPH_STATES,
  RISK_LEVELS,
  JOURNEY_STATES,
  normalizePriority,
  normalizeRiskLevel,
  normalizeProgressState,
  normalizeGraphState,
  normalizeJourneyState,
  normalizeTodoStatus,
  isTodoDone,
  evaluateGraph,
  resolveTaskNodeStatus
};
