'use strict';

const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const taskNodesRepo = require('../../repos/firestore/taskNodesRepo');
const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const eventsRepo = require('../../repos/firestore/eventsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId } = require('./osContext');

function parseLimit(req) {
  const url = new URL(req.url, 'http://localhost');
  const raw = Number(url.searchParams.get('limit') || 100);
  if (!Number.isFinite(raw) || raw < 1) return 100;
  return Math.min(Math.floor(raw), 500);
}

function parseLineUserId(req) {
  const url = new URL(req.url, 'http://localhost');
  const value = url.searchParams.get('lineUserId');
  if (typeof value !== 'string') return '';
  return value.trim();
}

function parseFilter(req, key) {
  const url = new URL(req.url, 'http://localhost');
  const value = url.searchParams.get(key);
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value > 1000000000000 ? value : value * 1000).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function toRuntimeNode(item) {
  const payload = item && typeof item === 'object' ? item : {};
  return {
    todoKey: payload.todoKey || '',
    title: payload.title || payload.todoKey || '',
    status: payload.status || 'open',
    progressState: payload.progressState || 'not_started',
    graphStatus: payload.graphStatus || 'actionable',
    journeyState: payload.journeyState || null,
    phaseKey: payload.phaseKey || null,
    domainKey: payload.domainKey || null,
    planTier: payload.planTier || 'all',
    dependsOn: Array.isArray(payload.dependsOn) ? payload.dependsOn : [],
    lockReasons: Array.isArray(payload.lockReasons) ? payload.lockReasons : [],
    dueAt: payload.dueAt || null,
    snoozeUntil: payload.snoozeUntil || null,
    lastSignal: payload.lastSignal || null,
    stateEvidenceRef: payload.stateEvidenceRef || null,
    stateUpdatedAt: payload.stateUpdatedAt || null,
    graphEvaluatedAt: payload.graphEvaluatedAt || null,
    updatedAt: toIso(payload.updatedAt)
  };
}

function buildCatalogEdgeMap(catalogEdges) {
  const map = new Map();
  (Array.isArray(catalogEdges) ? catalogEdges : []).forEach((edge) => {
    if (!edge || typeof edge !== 'object') return;
    const from = String(edge.from || '').trim();
    const to = String(edge.to || '').trim();
    if (!from || !to) return;
    const marker = `${from}|${to}`;
    map.set(marker, {
      edgeId: typeof edge.edgeId === 'string' && edge.edgeId.trim()
        ? edge.edgeId.trim()
        : `${from}__${to}__${typeof edge.reasonType === 'string' ? edge.reasonType : 'prerequisite'}`,
      reasonType: typeof edge.reasonType === 'string' && edge.reasonType.trim()
        ? edge.reasonType.trim()
        : 'prerequisite',
      reasonLabel: typeof edge.reasonLabel === 'string' && edge.reasonLabel.trim()
        ? edge.reasonLabel.trim()
        : null,
      required: edge.required !== false,
      enabled: edge.enabled !== false,
      version: Number.isFinite(Number(edge.version)) ? Math.max(1, Math.floor(Number(edge.version))) : 1
    });
  });
  return map;
}

function buildEdges(nodes, catalogEdges) {
  const out = [];
  const seen = new Set();
  const catalogEdgeMap = buildCatalogEdgeMap(catalogEdges);
  const nodeKeys = new Set((Array.isArray(nodes) ? nodes : []).map((node) => String(node && node.todoKey ? node.todoKey : '').trim()).filter(Boolean));
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    deps.forEach((dep) => {
      const from = String(dep || '').trim();
      const to = String(node.todoKey || '').trim();
      if (!from || !to) return;
      const marker = `${from}|${to}`;
      if (seen.has(marker)) return;
      seen.add(marker);
      const edgeMeta = catalogEdgeMap.get(marker);
      out.push({
        edgeId: edgeMeta && edgeMeta.edgeId ? edgeMeta.edgeId : `${from}__${to}__prerequisite`,
        from,
        to,
        reasonType: edgeMeta && edgeMeta.reasonType ? edgeMeta.reasonType : 'prerequisite',
        reasonLabel: edgeMeta ? edgeMeta.reasonLabel : null,
        required: edgeMeta ? edgeMeta.required !== false : true,
        enabled: edgeMeta ? edgeMeta.enabled !== false : true,
        version: edgeMeta && Number.isFinite(Number(edgeMeta.version)) ? Number(edgeMeta.version) : 1
      });
    });
  });
  (Array.isArray(catalogEdges) ? catalogEdges : []).forEach((edge) => {
    if (!edge || typeof edge !== 'object') return;
    const from = String(edge.from || '').trim();
    const to = String(edge.to || '').trim();
    if (!from || !to) return;
    if (!nodeKeys.has(to)) return;
    const marker = `${from}|${to}`;
    if (seen.has(marker)) return;
    seen.add(marker);
    out.push({
      edgeId: typeof edge.edgeId === 'string' && edge.edgeId.trim()
        ? edge.edgeId.trim()
        : `${from}__${to}__${typeof edge.reasonType === 'string' ? edge.reasonType : 'prerequisite'}`,
      from,
      to,
      reasonType: typeof edge.reasonType === 'string' && edge.reasonType.trim()
        ? edge.reasonType.trim()
        : 'prerequisite',
      reasonLabel: typeof edge.reasonLabel === 'string' && edge.reasonLabel.trim()
        ? edge.reasonLabel.trim()
        : null,
      required: edge.required !== false,
      enabled: edge.enabled !== false,
      version: Number.isFinite(Number(edge.version)) ? Math.max(1, Math.floor(Number(edge.version))) : 1
    });
  });
  return out;
}

function applyRuntimeFilter(nodes, filters) {
  const payload = filters && typeof filters === 'object' ? filters : {};
  return (Array.isArray(nodes) ? nodes : []).filter((node) => {
    if (payload.phase && String(node.phaseKey || '').toLowerCase() !== payload.phase) return false;
    if (payload.domain && String(node.domainKey || '').toLowerCase() !== payload.domain) return false;
    if (payload.state && String(node.journeyState || '').toLowerCase() !== payload.state) return false;
    if (payload.plan && String(node.planTier || '').toLowerCase() !== payload.plan) return false;
    return true;
  });
}

async function handleRuntime(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const lineUserId = parseLineUserId(req);
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required', traceId, requestId }));
    return;
  }

  const limit = parseLimit(req);
  const filters = {
    phase: parseFilter(req, 'phase'),
    domain: parseFilter(req, 'domain'),
    state: parseFilter(req, 'state'),
    plan: parseFilter(req, 'plan')
  };

  const [todos, taskNodes, journeyGraphCatalog] = await Promise.all([
    journeyTodoItemsRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit }),
    taskNodesRepo.listTaskNodesByLineUserId({ lineUserId, limit }).catch(() => []),
    journeyGraphCatalogRepo.getJourneyGraphCatalog().catch(() => null)
  ]);
  const todoNodes = todos.map((item) => toRuntimeNode(item));
  const filteredNodes = applyRuntimeFilter(todoNodes, filters);
  const catalogEdges = journeyGraphCatalog && Array.isArray(journeyGraphCatalog.edges)
    ? journeyGraphCatalog.edges
    : [];
  const edges = buildEdges(filteredNodes, catalogEdges);

  await appendAuditLog({
    actor,
    action: 'journey_graph.runtime.view',
    entityType: 'journey_graph',
    entityId: lineUserId,
    traceId,
    requestId,
    payloadSummary: {
      lineUserId,
      limit,
      nodeCount: filteredNodes.length,
      edgeCount: edges.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    lineUserId,
    filters,
    nodes: filteredNodes,
    edges,
    taskNodes,
    summary: {
      totalNodes: filteredNodes.length,
      totalEdges: edges.length,
      requiredEdges: edges.filter((edge) => edge.required !== false).length,
      optionalEdges: edges.filter((edge) => edge.required === false).length,
      enabledEdges: edges.filter((edge) => edge.enabled !== false).length,
      disabledEdges: edges.filter((edge) => edge.enabled === false).length,
      done: filteredNodes.filter((node) => node.journeyState === 'done').length,
      blocked: filteredNodes.filter((node) => node.journeyState === 'blocked').length,
      snoozed: filteredNodes.filter((node) => node.journeyState === 'snoozed').length
    },
    catalog: {
      enabled: journeyGraphCatalog && journeyGraphCatalog.enabled === true,
      schemaVersion: journeyGraphCatalog && journeyGraphCatalog.schemaVersion ? journeyGraphCatalog.schemaVersion : null
    }
  }));
}

async function handleRuntimeHistory(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);
  const lineUserId = parseLineUserId(req);
  if (!lineUserId) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'lineUserId required', traceId, requestId }));
    return;
  }

  const limit = parseLimit(req);
  const events = await eventsRepo.listEventsByUser(lineUserId, limit).catch(() => []);
  const items = events
    .filter((event) => {
      const type = String(event && event.type ? event.type : '').toLowerCase();
      return type === 'journey_reaction'
        || type === 'journey_state_change'
        || type === 'next_action_shown'
        || type === 'next_action_completed'
        || type === 'pro_prompted';
    })
    .slice(0, limit);

  await appendAuditLog({
    actor,
    action: 'journey_graph.runtime.history.view',
    entityType: 'journey_graph',
    entityId: lineUserId,
    traceId,
    requestId,
    payloadSummary: {
      lineUserId,
      limit,
      count: items.length
    }
  });

  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify({
    ok: true,
    traceId,
    requestId,
    lineUserId,
    limit,
    items
  }));
}

module.exports = {
  handleRuntime,
  handleRuntimeHistory
};
