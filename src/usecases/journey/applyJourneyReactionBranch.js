'use strict';

const journeyGraphCatalogRepo = require('../../repos/firestore/journeyGraphCatalogRepo');
const journeyBranchQueueRepo = require('../../repos/firestore/journeyBranchQueueRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { recomputeJourneyTaskGraph } = require('./recomputeJourneyTaskGraph');

function resolveFeatureEnabled() {
  const raw = process.env.ENABLE_JOURNEY_BRANCH_QUEUE_V1;
  if (typeof raw !== 'string') return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'on';
}

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function normalizePlan(value) {
  return normalizeLower(value) === 'pro' ? 'pro' : 'free';
}

function normalizeAction(value) {
  const action = normalizeLower(value);
  if (!action) throw new Error('action required');
  return action;
}

function normalizeRuleList(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => item && typeof item === 'object');
}

function matchesRule(rule, ctx) {
  if (!rule || typeof rule !== 'object') return false;
  if (rule.enabled === false) return false;
  const match = rule.match && typeof rule.match === 'object' ? rule.match : {};
  const actions = Array.isArray(match.actions) ? match.actions : [];
  if (!actions.includes(ctx.action)) return false;

  const planTiers = Array.isArray(match.planTiers) ? match.planTiers : [];
  if (planTiers.length > 0 && !planTiers.includes(ctx.plan)) return false;

  const todoKeys = Array.isArray(match.todoKeys) ? match.todoKeys : [];
  if (todoKeys.length > 0) {
    if (!ctx.todoKey || !todoKeys.includes(ctx.todoKey)) return false;
  }

  const notificationGroups = Array.isArray(match.notificationGroups) ? match.notificationGroups : [];
  if (notificationGroups.length > 0) {
    if (!ctx.notificationGroup || !notificationGroups.includes(ctx.notificationGroup)) return false;
  }

  const phaseKeys = Array.isArray(match.phaseKeys) ? match.phaseKeys : [];
  if (phaseKeys.length > 0) {
    if (!ctx.phaseKey || !phaseKeys.includes(ctx.phaseKey)) return false;
  }

  const domainKeys = Array.isArray(match.domainKeys) ? match.domainKeys : [];
  if (domainKeys.length > 0) {
    if (!ctx.domainKey || !domainKeys.includes(ctx.domainKey)) return false;
  }

  return true;
}

async function applyTodoPatch(todoRepo, lineUserId, todoKey, patch, nowIso) {
  if (!todoKey) return { ok: false, reason: 'todo_missing' };
  const current = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
  if (!current) return { ok: false, reason: 'todo_not_found' };
  const merged = Object.assign({}, patch || {}, {
    stateUpdatedAt: nowIso,
    source: 'journey_reaction_branch'
  });
  await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, merged);
  return { ok: true };
}

async function applyNodeUnlock(todoRepo, lineUserId, unlockTodoKeys, completedTodoKey, nowIso) {
  const keys = Array.isArray(unlockTodoKeys) ? unlockTodoKeys.map((item) => normalizeText(item)).filter(Boolean) : [];
  if (!keys.length || !completedTodoKey) return { updated: 0 };
  let updated = 0;
  for (const todoKey of keys) {
    // eslint-disable-next-line no-await-in-loop
    const current = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
    if (!current) continue;
    const dependsOn = Array.isArray(current.dependsOn)
      ? current.dependsOn.filter((dep) => dep !== completedTodoKey)
      : [];
    const dependencyReasonMap = current && current.dependencyReasonMap && typeof current.dependencyReasonMap === 'object'
      ? Object.keys(current.dependencyReasonMap).reduce((acc, key) => {
        if (key !== completedTodoKey) acc[key] = current.dependencyReasonMap[key];
        return acc;
      }, {})
      : {};
    const reasonChanged = current && current.dependencyReasonMap && typeof current.dependencyReasonMap === 'object'
      ? Object.prototype.hasOwnProperty.call(current.dependencyReasonMap, completedTodoKey)
      : false;
    if (Array.isArray(current.dependsOn) && current.dependsOn.length === dependsOn.length && !reasonChanged) continue;
    // eslint-disable-next-line no-await-in-loop
    await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, {
      dependsOn,
      dependencyReasonMap,
      graphStatus: 'actionable',
      stateUpdatedAt: nowIso,
      source: 'journey_reaction_branch'
    });
    updated += 1;
  }
  return { updated };
}

async function applyTodoCreate(todoRepo, lineUserId, todoCreate, nowIso) {
  const list = Array.isArray(todoCreate) ? todoCreate : [];
  let created = 0;
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const todoKey = normalizeText(item.todoKey);
    if (!todoKey) continue;
    const existing = await todoRepo.getJourneyTodoItem(lineUserId, todoKey);
    if (existing) continue;
    // eslint-disable-next-line no-await-in-loop
    await todoRepo.upsertJourneyTodoItem(lineUserId, todoKey, {
      title: normalizeText(item.title) || todoKey,
      status: 'open',
      progressState: 'not_started',
      graphStatus: 'actionable',
      journeyState: normalizeLower(item.journeyState) || 'planned',
      phaseKey: normalizeText(item.phaseKey) || null,
      domainKey: normalizeText(item.domainKey) || null,
      planTier: normalizeLower(item.planTier) === 'pro' ? 'pro' : 'all',
      dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn.map((dep) => normalizeText(dep)).filter(Boolean) : [],
      dueAt: normalizeText(item.dueAt) || null,
      dueDate: normalizeText(item.dueAt).slice(0, 10) || null,
      priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : 3,
      riskLevel: normalizeLower(item.riskLevel) || 'medium',
      stateUpdatedAt: nowIso,
      source: 'journey_reaction_branch'
    });
    created += 1;
  }
  return { created };
}

async function applyJourneyReactionBranch(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const deliveryId = normalizeText(payload.deliveryId);
  const action = normalizeAction(payload.action);
  const plan = normalizePlan(payload.plan);
  const todoKey = normalizeText(payload.todoKey) || null;
  const nowIso = payload.now || new Date().toISOString();
  if (!lineUserId) throw new Error('lineUserId required');
  if (!deliveryId) throw new Error('deliveryId required');

  if (!resolveFeatureEnabled()) {
    return {
      ok: true,
      enabled: false,
      reason: 'disabled_by_flag',
      matchedRules: [],
      queuedCount: 0,
      todoPatched: false,
      todoCreatedCount: 0,
      unlockedCount: 0
    };
  }

  const catalogRepo = resolvedDeps.journeyGraphCatalogRepo || journeyGraphCatalogRepo;
  const queueRepo = resolvedDeps.journeyBranchQueueRepo || journeyBranchQueueRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const recomputeFn = resolvedDeps.recomputeJourneyTaskGraph || recomputeJourneyTaskGraph;

  const catalog = payload.journeyGraphCatalog || await catalogRepo.getJourneyGraphCatalog();
  if (!catalog || catalog.enabled !== true) {
    return {
      ok: true,
      enabled: false,
      reason: 'catalog_disabled',
      matchedRules: [],
      queuedCount: 0,
      todoPatched: false,
      todoCreatedCount: 0,
      unlockedCount: 0
    };
  }

  const reactionBranches = normalizeRuleList(catalog.ruleSet && catalog.ruleSet.reactionBranches);
  if (!reactionBranches.length) {
    return {
      ok: true,
      enabled: true,
      reason: 'no_rules',
      matchedRules: [],
      queuedCount: 0,
      todoPatched: false,
      todoCreatedCount: 0,
      unlockedCount: 0
    };
  }

  const contextTodo = todoKey
    ? await todoRepo.getJourneyTodoItem(lineUserId, todoKey).catch(() => null)
    : null;
  const context = {
    action,
    plan,
    todoKey,
    notificationGroup: normalizeLower(payload.notificationGroup) || null,
    phaseKey: normalizeLower(payload.phaseKey || (contextTodo && contextTodo.phaseKey) || ''),
    domainKey: normalizeLower(payload.domainKey || (contextTodo && contextTodo.domainKey) || '')
  };

  const matchedRules = reactionBranches
    .filter((rule) => matchesRule(rule, context))
    .sort((a, b) => {
      const pa = Number.isFinite(Number(a.priority)) ? Number(a.priority) : 1000;
      const pb = Number.isFinite(Number(b.priority)) ? Number(b.priority) : 1000;
      if (pa !== pb) return pa - pb;
      return String(a.ruleId || '').localeCompare(String(b.ruleId || ''), 'ja');
    });

  if (!matchedRules.length) {
    return {
      ok: true,
      enabled: true,
      reason: 'not_matched',
      matchedRules: [],
      queuedCount: 0,
      todoPatched: false,
      todoCreatedCount: 0,
      unlockedCount: 0
    };
  }

  let queuedCount = 0;
  let todoPatched = false;
  let todoCreatedCount = 0;
  let unlockedCount = 0;

  for (const rule of matchedRules) {
    const effect = rule.effect && typeof rule.effect === 'object' ? rule.effect : {};

    const patchResult = await applyTodoPatch(todoRepo, lineUserId, todoKey, effect.todoPatch || {}, nowIso);
    if (patchResult.ok) todoPatched = true;

    const createResult = await applyTodoCreate(todoRepo, lineUserId, effect.todoCreate, nowIso);
    todoCreatedCount += createResult.created;

    const unlockResult = await applyNodeUnlock(todoRepo, lineUserId, effect.nodeUnlockKeys, todoKey, nowIso);
    unlockedCount += unlockResult.updated;

    if (effect.queueDispatch !== false) {
      // eslint-disable-next-line no-await-in-loop
      await queueRepo.enqueueJourneyBranch({
        lineUserId,
        deliveryId,
        todoKey,
        action,
        plan,
        ruleId: rule.ruleId,
        effect,
        traceId: payload.traceId || null,
        requestId: payload.requestId || null,
        actor: payload.actor || 'journey_reaction_branch',
        nextAttemptAt: nowIso
      });
      queuedCount += 1;
    }
  }

  if (todoPatched || todoCreatedCount > 0 || unlockedCount > 0) {
    await recomputeFn({
      lineUserId,
      actor: payload.actor || 'journey_reaction_branch',
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      failOnCycle: false
    }, resolvedDeps).catch(() => null);
  }

  return {
    ok: true,
    enabled: true,
    reason: 'applied',
    matchedRules: matchedRules.map((rule) => rule.ruleId),
    queuedCount,
    todoPatched,
    todoCreatedCount,
    unlockedCount
  };
}

module.exports = {
  applyJourneyReactionBranch
};
