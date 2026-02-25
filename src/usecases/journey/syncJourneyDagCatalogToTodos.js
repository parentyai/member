'use strict';

const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const { resolvePlan } = require('../billing/planGate');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveBooleanEnvFlag(name, defaultValue) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return defaultValue === true;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  return defaultValue === true;
}

function resolveJourneyDagCatalogEnabled(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.forceEnabled === true) return true;
  if (payload.forceEnabled === false) return false;
  return resolveBooleanEnvFlag('ENABLE_JOURNEY_DAG_CATALOG_V1', false);
}

function toIso(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) return null;
    const parsed = Date.parse(text);
    if (!Number.isFinite(parsed)) return null;
    return new Date(parsed).toISOString();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const ms = value > 1000000000000 ? value : value * 1000;
    return new Date(ms).toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function toIsoDate(value) {
  const iso = toIso(value);
  return iso ? iso.slice(0, 10) : null;
}

function computeNextReminderAt(dueAt, reminderOffsetsDays, remindedOffsetsDays, nowIso) {
  const dueMs = Date.parse(dueAt || '');
  if (!Number.isFinite(dueMs)) return null;
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (!Number.isFinite(nowMs)) return null;
  const offsets = Array.isArray(reminderOffsetsDays) ? reminderOffsetsDays : [7, 3, 1];
  const reminded = new Set(Array.isArray(remindedOffsetsDays) ? remindedOffsetsDays.map((value) => Number(value)) : []);
  const candidates = offsets
    .map((offset) => Number(offset))
    .filter((offset) => Number.isInteger(offset) && offset >= 0 && !reminded.has(offset))
    .map((offset) => ({
      offset,
      remindMs: dueMs - (offset * DAY_MS)
    }))
    .filter((item) => item.remindMs >= nowMs)
    .sort((a, b) => a.remindMs - b.remindMs);
  if (!candidates.length) return null;
  return new Date(candidates[0].remindMs).toISOString();
}

function normalizePlan(planInfo) {
  if (planInfo && planInfo.plan === 'pro') return 'pro';
  return 'free';
}

function isNodeUnlockedForPlan(node, planInfo, planUnlocks) {
  const payload = node && typeof node === 'object' ? node : {};
  const tier = typeof payload.planTier === 'string' ? payload.planTier.trim().toLowerCase() : 'all';
  const plan = normalizePlan(planInfo);
  if (tier === 'pro' && plan !== 'pro') return false;
  const unlock = planUnlocks && typeof planUnlocks === 'object' ? planUnlocks[plan] : null;
  if (!unlock || !Array.isArray(unlock.includePlanTiers) || unlock.includePlanTiers.length === 0) {
    return tier === 'all' || (tier === 'pro' && plan === 'pro');
  }
  return unlock.includePlanTiers.includes(tier);
}

function resolveReminderOffsets(node, policy) {
  const payload = node && typeof node === 'object' ? node : {};
  if (Array.isArray(payload.reminderOffsetsDays) && payload.reminderOffsetsDays.length) {
    return payload.reminderOffsetsDays;
  }
  if (policy && Array.isArray(policy.reminder_offsets_days) && policy.reminder_offsets_days.length) {
    return policy.reminder_offsets_days;
  }
  return [7, 3, 1];
}

function normalizeDependsOn(node, edges) {
  const payload = node && typeof node === 'object' ? node : {};
  if (Array.isArray(payload.dependsOn) && payload.dependsOn.length) {
    return {
      dependsOn: Array.from(new Set(payload.dependsOn.map((item) => String(item || '').trim()).filter(Boolean))),
      dependencyReasonMap: payload.dependencyReasonMap && typeof payload.dependencyReasonMap === 'object'
        ? Object.assign({}, payload.dependencyReasonMap)
        : {}
    };
  }
  const nodeKey = String(payload.nodeKey || payload.todoKey || '').trim();
  if (!nodeKey || !Array.isArray(edges)) return { dependsOn: [], dependencyReasonMap: {} };
  const out = [];
  const dependencyReasonMap = {};
  edges.forEach((edge) => {
    if (!edge || typeof edge !== 'object') return;
    const to = String(edge.to || '').trim();
    const from = String(edge.from || '').trim();
    if (!to || !from) return;
    if (to !== nodeKey) return;
    if (edge.required === false) return;
    if (!out.includes(from)) out.push(from);
    const reasonType = typeof edge.reasonType === 'string' && edge.reasonType.trim()
      ? edge.reasonType.trim()
      : 'prerequisite';
    const reasonLabel = typeof edge.reasonLabel === 'string' && edge.reasonLabel.trim()
      ? edge.reasonLabel.trim()
      : null;
    dependencyReasonMap[from] = reasonLabel ? `${reasonType}:${reasonLabel}` : reasonType;
  });
  return {
    dependsOn: out,
    dependencyReasonMap
  };
}

async function syncJourneyDagCatalogToTodos(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) throw new Error('lineUserId required');

  if (!resolveJourneyDagCatalogEnabled(payload)) {
    return {
      ok: true,
      lineUserId,
      status: 'disabled_by_flag',
      syncedCount: 0
    };
  }

  const catalogRepo = resolvedDeps.journeyGraphCatalogRepo || journeyGraphCatalogRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const planResolver = resolvedDeps.resolvePlan || resolvePlan;

  const [catalog, policy, planInfo, existingItems] = await Promise.all([
    payload.journeyGraphCatalog || catalogRepo.getJourneyGraphCatalog(),
    payload.journeyPolicy || policyRepo.getJourneyPolicy(),
    payload.planInfo || planResolver(lineUserId),
    todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 1000 })
  ]);

  if (!catalog || catalog.enabled !== true) {
    return {
      ok: true,
      lineUserId,
      status: 'disabled_by_catalog',
      syncedCount: 0
    };
  }

  const nodes = Array.isArray(catalog.nodes) ? catalog.nodes : [];
  const edges = Array.isArray(catalog.edges) ? catalog.edges : [];
  const existingMap = new Map();
  existingItems.forEach((item) => {
    if (!item || !item.todoKey) return;
    existingMap.set(item.todoKey, item);
  });

  const nowIso = payload.now || new Date().toISOString();
  let syncedCount = 0;

  for (const node of nodes) {
    const nodeKey = String(node && node.nodeKey ? node.nodeKey : '').trim();
    if (!nodeKey) continue;
    if (!isNodeUnlockedForPlan(node, planInfo, catalog.planUnlocks)) continue;

    const existing = existingMap.get(nodeKey) || null;
    const dependency = normalizeDependsOn(node, edges);
    const reminderOffsetsDays = resolveReminderOffsets(node, policy);
    const remindedOffsetsDays = existing && Array.isArray(existing.remindedOffsetsDays)
      ? existing.remindedOffsetsDays
      : [];
    const dueAt = toIso(node && node.dueAt) || (existing && existing.dueAt ? existing.dueAt : null);
    const dueDate = toIsoDate(node && node.dueAt) || (existing && existing.dueDate ? existing.dueDate : null);
    const nextReminderAt = dueAt
      ? computeNextReminderAt(dueAt, reminderOffsetsDays, remindedOffsetsDays, nowIso)
      : null;
    const existingStatus = existing && (existing.status === 'completed' || existing.status === 'skipped')
      ? existing.status
      : 'open';
    const journeyState = existing && existing.journeyState
      ? existing.journeyState
      : (existingStatus === 'open'
        ? (node.defaultJourneyState || 'planned')
        : (existingStatus === 'completed' ? 'done' : 'skipped'));

    // eslint-disable-next-line no-await-in-loop
    await todoRepo.upsertJourneyTodoItem(lineUserId, nodeKey, {
      lineUserId,
      todoKey: nodeKey,
      title: node && node.title ? node.title : nodeKey,
      status: existingStatus,
      progressState: existing && existing.progressState ? existing.progressState : 'not_started',
      graphStatus: existing && existing.graphStatus ? existing.graphStatus : 'actionable',
      dependsOn: dependency.dependsOn,
      dependencyReasonMap: dependency.dependencyReasonMap,
      priority: Number.isFinite(Number(node && node.priority)) ? Math.floor(Number(node.priority)) : 3,
      riskLevel: node && node.riskLevel ? node.riskLevel : 'medium',
      lockReasons: existing && Array.isArray(existing.lockReasons) ? existing.lockReasons : [],
      reminderOffsetsDays,
      remindedOffsetsDays,
      nextReminderAt,
      reminderCount: existing && Number.isFinite(Number(existing.reminderCount)) ? Number(existing.reminderCount) : 0,
      dueAt,
      dueDate,
      sourceTemplateVersion: `journey_dag_catalog_v${Number.isFinite(Number(catalog.schemaVersion)) ? Math.floor(Number(catalog.schemaVersion)) : 1}`,
      source: payload.source || 'journey_dag_catalog_sync',
      journeyState,
      phaseKey: node && node.phaseKey ? node.phaseKey : null,
      domainKey: node && node.domainKey ? node.domainKey : null,
      planTier: node && node.planTier ? node.planTier : 'all',
      stateUpdatedAt: nowIso
    });
    syncedCount += 1;
  }

  let graph = null;
  if (payload.skipRecompute !== true) {
    graph = await recomputeJourneyTaskGraph({
      lineUserId,
      actor: payload.source || 'journey_dag_catalog_sync',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      failOnCycle: false
    }, resolvedDeps).catch(() => ({ ok: false, reason: 'graph_recompute_failed' }));
  }

  let stats = null;
  if (payload.skipStatsRefresh !== true && typeof resolvedDeps.refreshJourneyTodoStats === 'function') {
    stats = await resolvedDeps.refreshJourneyTodoStats(lineUserId, resolvedDeps, nowIso).catch(() => null);
  }

  return {
    ok: true,
    lineUserId,
    status: 'synced',
    syncedCount,
    plan: normalizePlan(planInfo),
    graph,
    stats
  };
}

module.exports = {
  syncJourneyDagCatalogToTodos
};
