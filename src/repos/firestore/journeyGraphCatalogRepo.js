'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'opsConfig';
const DOC_ID = 'journeyGraphCatalog';
const MAX_NODE_COUNT = 1200;
const MAX_EDGE_COUNT = 4000;
const MAX_REACTION_BRANCH_COUNT = 300;

const ALLOWED_PLAN_TIERS = Object.freeze(['all', 'pro']);
const ALLOWED_RUNTIME_PLAN_TIERS = Object.freeze(['free', 'pro']);
const ALLOWED_JOURNEY_STATES = Object.freeze(['planned', 'in_progress', 'done', 'blocked', 'snoozed', 'skipped']);
const ALLOWED_EDGE_REASON_TYPES = Object.freeze([
  'prerequisite',
  'address_dependency',
  'ssn_dependency',
  'deadline',
  'reaction_branch',
  'custom'
]);
const ALLOWED_REACTION_ACTIONS = Object.freeze(['open', 'save', 'snooze', 'none', 'redeem', 'response']);

const DEFAULT_JOURNEY_GRAPH_CATALOG = Object.freeze({
  enabled: false,
  schemaVersion: 1,
  nodes: [],
  edges: [],
  ruleSet: Object.freeze({
    notificationGroups: Object.freeze({
      life_info: ['DEADLINE_REQUIRED'],
      savings: ['IMMEDIATE_ACTION'],
      campaign: ['TARGETED_ONLY'],
      survey: ['COMPLETION_CONFIRMATION']
    }),
    stopSignals: ['redeem', 'response'],
    signalReminderOffsets: Object.freeze({}),
    reactionBranches: Object.freeze([]),
    minIntervalHoursByPlan: Object.freeze({
      free: 24,
      pro: 12
    }),
    maxRemindersByPlan: Object.freeze({
      free: 3,
      pro: 6
    }),
    globalDailyCap: 3
  }),
  planUnlocks: Object.freeze({
    free: Object.freeze({
      includePlanTiers: ['all'],
      maxNextActions: 1
    }),
    pro: Object.freeze({
      includePlanTiers: ['all', 'pro'],
      maxNextActions: 3
    })
  })
});

function cloneDefault() {
  return JSON.parse(JSON.stringify(DEFAULT_JOURNEY_GRAPH_CATALOG));
}

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return fallback;
  return normalized;
}

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeInteger(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  const parsed = Math.floor(num);
  if (parsed < min || parsed > max) return null;
  return parsed;
}

function normalizeStringList(values, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const allowed = Array.isArray(opts.allowed) ? opts.allowed : null;
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((item) => {
    const normalized = normalizeText(item, '');
    if (!normalized) return;
    let candidate = normalized;
    if (opts.lower === true) candidate = candidate.toLowerCase();
    if (opts.upper === true) candidate = candidate.toUpperCase();
    if (allowed && !allowed.includes(candidate)) return;
    if (!out.includes(candidate)) out.push(candidate);
  });
  return out;
}

function normalizePlanTier(value, fallback) {
  const normalized = normalizeText(value, fallback || 'all');
  if (!normalized) return 'all';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_PLAN_TIERS.includes(lowered)) return null;
  return lowered;
}

function normalizeJourneyState(value, fallback) {
  const normalized = normalizeText(value, fallback || 'planned');
  if (!normalized) return 'planned';
  const lowered = normalized.toLowerCase();
  if (!ALLOWED_JOURNEY_STATES.includes(lowered)) return null;
  return lowered;
}

function normalizeReminderOffsetsDays(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((value) => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed)) return;
    if (parsed < 0 || parsed > 365) return;
    if (!out.includes(parsed)) out.push(parsed);
  });
  return out;
}

function normalizeNotificationGroups(value, fallback) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out = {};
  Object.keys(raw).forEach((group) => {
    const key = normalizeText(group, '');
    if (!key) return;
    const categories = normalizeStringList(raw[group], { upper: true });
    out[key] = categories;
  });
  return out;
}

function normalizeSignalReminderOffsets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  Object.keys(value).forEach((signal) => {
    const key = normalizeText(signal, '');
    if (!key) return;
    const normalizedKey = key.toLowerCase();
    const offsets = normalizeReminderOffsetsDays(value[signal]);
    if (offsets.length > 0) out[normalizedKey] = offsets;
  });
  return out;
}

function normalizeReactionTodoCreateItem(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const todoKey = normalizeText(value.todoKey || value.nodeKey || value.id, '');
  if (!todoKey) return null;
  const planTier = normalizePlanTier(value.planTier, 'all');
  if (!planTier) return null;
  const journeyState = normalizeJourneyState(value.journeyState || value.defaultJourneyState || 'planned', 'planned');
  if (!journeyState) return null;
  return {
    todoKey,
    title: normalizeText(value.title || value.task, todoKey),
    phaseKey: normalizeText(value.phaseKey || value.phase, null),
    domainKey: normalizeText(value.domainKey || value.domain, null),
    planTier,
    dependsOn: normalizeStringList(value.dependsOn || value.prereq),
    dueAt: normalizeText(value.dueAt, null),
    priority: normalizeInteger(value.priority, 3, 1, 5) || 3,
    riskLevel: normalizeText(value.riskLevel, 'medium') || 'medium',
    journeyState
  };
}

function normalizeReactionTodoPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  const journeyState = value.journeyState === undefined
    ? null
    : normalizeJourneyState(value.journeyState, 'planned');
  if (journeyState) out.journeyState = journeyState;
  const snoozeUntil = normalizeText(value.snoozeUntil, null);
  if (snoozeUntil) out.snoozeUntil = snoozeUntil;
  const phaseKey = normalizeText(value.phaseKey, null);
  if (phaseKey) out.phaseKey = phaseKey;
  const domainKey = normalizeText(value.domainKey, null);
  if (domainKey) out.domainKey = domainKey;
  return out;
}

function normalizeReactionBranchMatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const actions = normalizeStringList(value.actions || value.action, {
    lower: true,
    allowed: ALLOWED_REACTION_ACTIONS
  });
  const planTiers = normalizeStringList(value.planTiers || value.planTier, {
    lower: true,
    allowed: ALLOWED_RUNTIME_PLAN_TIERS
  });
  const notificationGroups = normalizeStringList(value.notificationGroups || value.notificationGroup, { lower: true });
  const todoKeys = normalizeStringList(value.todoKeys || value.todoKey);
  const domainKeys = normalizeStringList(value.domainKeys || value.domainKey, { lower: true });
  const phaseKeys = normalizeStringList(value.phaseKeys || value.phaseKey, { lower: true });
  if (!actions.length) return null;
  return {
    actions,
    planTiers,
    notificationGroups,
    todoKeys,
    domainKeys,
    phaseKeys
  };
}

function normalizeReactionBranchEffect(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const nextTemplateId = normalizeText(value.nextTemplateId, null);
  const todoCreate = Array.isArray(value.todoCreate)
    ? value.todoCreate.map((item) => normalizeReactionTodoCreateItem(item)).filter(Boolean)
    : [];
  const todoPatch = normalizeReactionTodoPatch(value.todoPatch);
  const nodeUnlockKeys = normalizeStringList(value.nodeUnlockKeys || value.nodeUnlock || value.unlockTodoKeys);
  const queueDispatch = normalizeBoolean(value.queueDispatch, true);
  if (queueDispatch === null) return null;
  return {
    nextTemplateId,
    todoCreate,
    todoPatch,
    nodeUnlockKeys,
    queueDispatch
  };
}

function normalizeReactionBranch(value, index) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const ruleId = normalizeText(value.ruleId || value.id, `reaction_branch_${index + 1}`);
  if (!ruleId) return null;
  const enabled = normalizeBoolean(value.enabled, true);
  const priority = normalizeInteger(value.priority, 1000, 0, 100000);
  const match = normalizeReactionBranchMatch(value.match || value.when || {});
  const effect = normalizeReactionBranchEffect(value.effect || {});
  if (enabled === null || priority === null || !match || !effect) return null;
  return {
    ruleId,
    enabled,
    priority,
    match,
    effect
  };
}

function normalizeReactionBranches(value, fallback) {
  const source = value === null || value === undefined ? fallback : value;
  if (!Array.isArray(source)) return null;
  const out = [];
  const seen = new Set();
  source.forEach((item, index) => {
    const normalized = normalizeReactionBranch(item, index);
    if (!normalized) return;
    if (seen.has(normalized.ruleId)) return;
    seen.add(normalized.ruleId);
    out.push(normalized);
  });
  out.sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority;
    return a.ruleId.localeCompare(b.ruleId, 'ja');
  });
  if (out.length > MAX_REACTION_BRANCH_COUNT) return null;
  return out;
}

function normalizeRuleSet(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : cloneDefault().ruleSet;
  const raw = value === null || value === undefined ? base : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const stopSignals = normalizeStringList(raw.stopSignals, { lower: true });
  const notificationGroups = normalizeNotificationGroups(raw.notificationGroups, base.notificationGroups);
  const signalReminderOffsets = normalizeSignalReminderOffsets(raw.signalReminderOffsets);
  const reactionBranches = normalizeReactionBranches(raw.reactionBranches, base.reactionBranches);
  const minIntervalHoursByPlan = {
    free: normalizeInteger(
      raw.minIntervalHoursByPlan && raw.minIntervalHoursByPlan.free,
      base.minIntervalHoursByPlan.free,
      0,
      24 * 30
    ),
    pro: normalizeInteger(
      raw.minIntervalHoursByPlan && raw.minIntervalHoursByPlan.pro,
      base.minIntervalHoursByPlan.pro,
      0,
      24 * 30
    )
  };
  const maxRemindersByPlan = {
    free: normalizeInteger(
      raw.maxRemindersByPlan && raw.maxRemindersByPlan.free,
      base.maxRemindersByPlan.free,
      0,
      100
    ),
    pro: normalizeInteger(
      raw.maxRemindersByPlan && raw.maxRemindersByPlan.pro,
      base.maxRemindersByPlan.pro,
      0,
      100
    )
  };
  const globalDailyCap = normalizeInteger(raw.globalDailyCap, base.globalDailyCap, 0, 100);

  if (Object.values(minIntervalHoursByPlan).includes(null)) return null;
  if (Object.values(maxRemindersByPlan).includes(null)) return null;
  if (notificationGroups === null || reactionBranches === null || globalDailyCap === null) return null;

  return {
    notificationGroups,
    stopSignals,
    signalReminderOffsets,
    reactionBranches,
    minIntervalHoursByPlan,
    maxRemindersByPlan,
    globalDailyCap
  };
}

function normalizePlanUnlockEntry(value, fallback) {
  const raw = value === null || value === undefined ? fallback : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const includePlanTiers = normalizeStringList(raw.includePlanTiers, { lower: true, allowed: ALLOWED_PLAN_TIERS });
  const maxNextActions = normalizeInteger(raw.maxNextActions, fallback.maxNextActions, 0, 3);
  if (maxNextActions === null) return null;
  return {
    includePlanTiers: includePlanTiers.length ? includePlanTiers : fallback.includePlanTiers.slice(),
    maxNextActions
  };
}

function normalizePlanUnlocks(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : cloneDefault().planUnlocks;
  const raw = value === null || value === undefined ? base : value;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const free = normalizePlanUnlockEntry(raw.free, base.free);
  const pro = normalizePlanUnlockEntry(raw.pro, base.pro);
  if (!free || !pro) return null;
  return { free, pro };
}

function normalizeNode(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const nodeKey = normalizeText(value.nodeKey || value.id || value.todoKey, '');
  if (!nodeKey) return null;
  const planTier = normalizePlanTier(value.planTier, 'all');
  const defaultJourneyState = normalizeJourneyState(value.defaultJourneyState || value.journeyState, 'planned');
  const defaultDeadlineOffset = normalizeInteger(
    value.defaultDeadlineOffset !== undefined ? value.defaultDeadlineOffset : value.defaultDeadlineOffsetDays,
    0,
    -365,
    365
  );
  if (planTier === null || defaultJourneyState === null) return null;
  if (defaultDeadlineOffset === null) return null;
  const dependsOn = normalizeStringList(value.dependsOn || value.prereq || value.prereqIds);
  return {
    nodeKey,
    id: nodeKey,
    title: normalizeText(value.title || value.task, nodeKey),
    phaseKey: normalizeText(value.phaseKey || value.phase, null),
    phase: normalizeText(value.phase || value.phaseKey, null),
    domainKey: normalizeText(value.domainKey || value.domain, null),
    domain: normalizeText(value.domain || value.domainKey, null),
    planTier,
    owner: normalizeText(value.owner, null),
    trigger: normalizeText(value.trigger, null),
    deadline: normalizeText(value.deadline, null),
    dueAt: normalizeText(value.dueAt, null),
    output: normalizeText(value.output, null),
    evidence: normalizeText(value.evidence, null),
    evidenceKeys: normalizeStringList(value.evidenceKeys),
    notificationGroup: normalizeText(value.notificationGroup, null),
    dependsOn,
    prereqIds: dependsOn.slice(),
    unlockCondition: normalizeText(value.unlockCondition, null),
    completionCriteria: normalizeText(value.completionCriteria, null),
    defaultDeadlineOffset,
    defaultDeadlineOffsetDays: defaultDeadlineOffset,
    reminderOffsetsDays: normalizeReminderOffsetsDays(value.reminderOffsetsDays),
    defaultJourneyState,
    sortOrder: normalizeInteger(value.sortOrder, 0, 0, 100000) || 0
  };
}

function normalizeNodes(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  values.forEach((item) => {
    const normalized = normalizeNode(item);
    if (!normalized) return;
    if (seen.has(normalized.nodeKey)) return;
    seen.add(normalized.nodeKey);
    out.push(normalized);
  });
  out.sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.nodeKey.localeCompare(b.nodeKey, 'ja');
  });
  return out;
}

function normalizeEdge(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const from = normalizeText(value.from || value.fromNode || value.prereqNodeKey, '');
  const to = normalizeText(value.to || value.toNode || value.nodeKey, '');
  if (!from || !to) return null;
  const reasonTypeRaw = normalizeText(value.reasonType || value.type || value.reason || 'prerequisite', 'prerequisite');
  const reasonType = reasonTypeRaw.toLowerCase();
  if (!ALLOWED_EDGE_REASON_TYPES.includes(reasonType)) return null;
  const enabled = normalizeBoolean(value.enabled, true);
  const version = normalizeInteger(value.version, 1, 1, 100000);
  if (enabled === null || version === null) return null;
  const edgeId = normalizeText(value.edgeId || value.id, `${from}__${to}__${reasonType}`);
  if (!edgeId) return null;
  return {
    edgeId,
    from,
    fromNode: from,
    to,
    toNode: to,
    type: reasonType,
    reasonType,
    reasonLabel: normalizeText(value.reasonLabel || value.reason, null),
    conditionSignal: normalizeText(value.conditionSignal || value.signal, null),
    required: normalizeBoolean(value.required, true) !== false,
    enabled,
    version
  };
}

function normalizeEdges(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  const seen = new Set();
  values.forEach((item) => {
    const normalized = normalizeEdge(item);
    if (!normalized) return;
    const marker = `${normalized.from}|${normalized.to}|${normalized.reasonType}|${normalized.conditionSignal || ''}`;
    if (seen.has(marker)) return;
    seen.add(marker);
    out.push(normalized);
  });
  return out;
}

function buildEdgesFromNodes(nodes) {
  const out = [];
  const seen = new Set();
  (Array.isArray(nodes) ? nodes : []).forEach((node) => {
    const deps = Array.isArray(node.dependsOn) ? node.dependsOn : [];
    deps.forEach((dep) => {
      const from = normalizeText(dep, '');
      if (!from) return;
      const marker = `${from}|${node.nodeKey}|prerequisite|`;
      if (seen.has(marker)) return;
      seen.add(marker);
      out.push({
        edgeId: `${from}__${node.nodeKey}__prerequisite`,
        from,
        fromNode: from,
        to: node.nodeKey,
        toNode: node.nodeKey,
        type: 'prerequisite',
        reasonType: 'prerequisite',
        reasonLabel: null,
        conditionSignal: null,
        required: true,
        enabled: true,
        version: 1
      });
    });
  });
  return out;
}

function normalizeJourneyGraphCatalog(input) {
  if (input === null || input === undefined) return cloneDefault();
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const defaults = cloneDefault();
  const enabled = normalizeBoolean(input.enabled, defaults.enabled);
  const schemaVersion = normalizeInteger(input.schemaVersion, defaults.schemaVersion, 1, 10);
  const nodes = normalizeNodes(input.nodes);
  const explicitEdges = normalizeEdges(input.edges);
  const impliedEdges = buildEdgesFromNodes(nodes);
  const mergedEdges = normalizeEdges(explicitEdges.concat(impliedEdges));
  const ruleSet = normalizeRuleSet(input.ruleSet, defaults.ruleSet);
  const planUnlocks = normalizePlanUnlocks(input.planUnlocks, defaults.planUnlocks);

  if ([enabled, schemaVersion, ruleSet, planUnlocks].includes(null)) return null;
  if (nodes.length > MAX_NODE_COUNT) return null;
  if (mergedEdges.length > MAX_EDGE_COUNT) return null;

  return {
    enabled,
    schemaVersion,
    nodes,
    edges: mergedEdges,
    ruleSet,
    planUnlocks
  };
}

async function getJourneyGraphCatalog() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return cloneDefault();
  const data = snap.data() || {};
  const normalized = normalizeJourneyGraphCatalog(data);
  if (!normalized) return cloneDefault();
  return Object.assign({}, normalized, {
    updatedAt: data.updatedAt || null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null
  });
}

async function setJourneyGraphCatalog(catalog, actor) {
  const normalized = normalizeJourneyGraphCatalog(catalog);
  if (!normalized) throw new Error('invalid journeyGraphCatalog');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getJourneyGraphCatalog();
}

module.exports = {
  COLLECTION,
  DOC_ID,
  MAX_NODE_COUNT,
  MAX_EDGE_COUNT,
  MAX_REACTION_BRANCH_COUNT,
  ALLOWED_PLAN_TIERS,
  ALLOWED_RUNTIME_PLAN_TIERS,
  ALLOWED_JOURNEY_STATES,
  ALLOWED_EDGE_REASON_TYPES,
  ALLOWED_REACTION_ACTIONS,
  DEFAULT_JOURNEY_GRAPH_CATALOG,
  normalizeJourneyGraphCatalog,
  getJourneyGraphCatalog,
  setJourneyGraphCatalog
};
