'use strict';

const crypto = require('crypto');

const usersRepo = require('../../repos/firestore/usersRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const journeyParamVersionsRepo = require('../../repos/firestore/journeyParamVersionsRepo');
const { resolvePlan } = require('../billing/planGate');
const { resolveEffectiveJourneyParams } = require('./resolveEffectiveJourneyParams');

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeString(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function normalizeLimit(value, fallback, max) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 1) return fallback;
  return Math.min(Math.floor(num), max);
}

function resolvePlanTier(planInfo) {
  return planInfo && planInfo.plan === 'pro' ? 'pro' : 'free';
}

function resolveUnlock(node, graph, planTier) {
  if (!node || typeof node !== 'object') return false;
  const nodeTier = typeof node.planTier === 'string' ? node.planTier.trim().toLowerCase() : 'all';
  const unlock = graph && graph.planUnlocks && graph.planUnlocks[planTier] && typeof graph.planUnlocks[planTier] === 'object'
    ? graph.planUnlocks[planTier]
    : null;
  const includePlanTiers = unlock && Array.isArray(unlock.includePlanTiers) ? unlock.includePlanTiers : (planTier === 'pro' ? ['all', 'pro'] : ['all']);
  return includePlanTiers.includes(nodeTier);
}

function collectUnlockedNodeKeys(graph, planTier) {
  const nodes = graph && Array.isArray(graph.nodes) ? graph.nodes : [];
  const out = new Set();
  nodes.forEach((node) => {
    const key = normalizeString(node && (node.nodeKey || node.id || node.todoKey));
    if (!key) return;
    if (resolveUnlock(node, graph, planTier)) out.add(key);
  });
  return out;
}

function resolveStopSignals(graph) {
  const signals = graph && graph.ruleSet && Array.isArray(graph.ruleSet.stopSignals)
    ? graph.ruleSet.stopSignals
    : [];
  return new Set(signals.map((item) => normalizeString(item).toLowerCase()).filter(Boolean));
}

function resolveTodoReminderOffsets(todo, graph, policy) {
  const nodeMap = new Map(
    (graph && Array.isArray(graph.nodes) ? graph.nodes : [])
      .map((node) => [normalizeString(node && node.nodeKey), node])
      .filter((entry) => entry[0])
  );
  const node = nodeMap.get(normalizeString(todo && todo.todoKey));
  if (node && Array.isArray(node.reminderOffsetsDays) && node.reminderOffsetsDays.length) {
    return node.reminderOffsetsDays;
  }
  if (Array.isArray(todo && todo.reminderOffsetsDays) && todo.reminderOffsetsDays.length) {
    return todo.reminderOffsetsDays;
  }
  if (policy && Array.isArray(policy.reminder_offsets_days) && policy.reminder_offsets_days.length) {
    return policy.reminder_offsets_days;
  }
  return [7, 3, 1];
}

function estimateReminderCountForTodo(todo, graph, policy, nowMs, horizonMs) {
  const dueMs = toMillis(todo && todo.dueAt);
  if (!Number.isFinite(dueMs)) return 0;
  if ((todo && todo.status) !== 'open') return 0;
  const signal = normalizeString(todo && todo.lastSignal).toLowerCase();
  const stopSignals = resolveStopSignals(graph);
  if (signal && stopSignals.has(signal)) return 0;
  const snoozeMs = toMillis(todo && todo.snoozeUntil);
  if (Number.isFinite(snoozeMs) && snoozeMs > nowMs) return 0;

  const remindedOffsets = Array.isArray(todo && todo.remindedOffsetsDays)
    ? new Set(todo.remindedOffsetsDays.map((item) => Number(item)).filter((item) => Number.isInteger(item)))
    : new Set();
  const offsets = resolveTodoReminderOffsets(todo, graph, policy)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 0);

  let count = 0;
  offsets.forEach((offset) => {
    if (remindedOffsets.has(offset)) return;
    const reminderAt = dueMs - (offset * DAY_MS);
    if (reminderAt >= nowMs && reminderAt <= horizonMs) count += 1;
  });
  return count;
}

function estimateAdditionalNotifications(todos, graph, policy, nowMs, horizonDays, planTier) {
  const horizonMs = nowMs + (horizonDays * DAY_MS);
  const list = Array.isArray(todos) ? todos : [];
  let total = 0;
  list.forEach((todo) => {
    total += estimateReminderCountForTodo(todo, graph, policy, nowMs, horizonMs);
  });

  const ruleSet = graph && graph.ruleSet && typeof graph.ruleSet === 'object' ? graph.ruleSet : {};
  const globalCap = Number(ruleSet.globalDailyCap);
  const days = Math.max(1, Math.ceil((horizonMs - nowMs) / DAY_MS));
  if (Number.isFinite(globalCap) && globalCap >= 0) {
    total = Math.min(total, globalCap * days);
  }

  const maxByPlan = Number(ruleSet.maxRemindersByPlan && ruleSet.maxRemindersByPlan[planTier]);
  if (Number.isFinite(maxByPlan) && maxByPlan >= 0) {
    const openCount = list.filter((todo) => todo && todo.status === 'open').length;
    total = Math.min(total, maxByPlan * Math.max(1, openCount));
  }

  return Math.max(0, Math.floor(total));
}

function resolveDeadlineShiftDays(todo, graph, policy) {
  const nodeMap = new Map(
    (graph && Array.isArray(graph.nodes) ? graph.nodes : [])
      .map((node) => [normalizeString(node && node.nodeKey), node])
      .filter((entry) => entry[0])
  );
  const node = nodeMap.get(normalizeString(todo && todo.todoKey));
  const nodeOffset = Number(node && (node.defaultDeadlineOffset || node.defaultDeadlineOffsetDays));
  const policyOffsets = policy && policy.deadlineOffsets && typeof policy.deadlineOffsets === 'object'
    ? policy.deadlineOffsets
    : {};
  const policyPhaseOffsets = policy && policy.deadlineOffsetsByPhase && typeof policy.deadlineOffsetsByPhase === 'object'
    ? policy.deadlineOffsetsByPhase
    : {};
  const keyOffset = Number(policyOffsets[normalizeString(todo && todo.todoKey)]);
  const phaseKey = normalizeString(todo && todo.phaseKey);
  const phaseOffset = Number(policyPhaseOffsets[phaseKey]);

  let shift = 0;
  if (Number.isFinite(nodeOffset)) shift += Math.floor(nodeOffset);
  if (Number.isFinite(keyOffset)) shift += Math.floor(keyOffset);
  if (Number.isFinite(phaseOffset)) shift += Math.floor(phaseOffset);
  return shift;
}

function estimateDeadlineBreachForecast(todos, graph, policy, nowMs) {
  const list = Array.isArray(todos) ? todos : [];
  let count = 0;
  list.forEach((todo) => {
    if (!todo || todo.status !== 'open') return;
    const dueMs = toMillis(todo.dueAt);
    if (!Number.isFinite(dueMs)) return;
    const shiftDays = resolveDeadlineShiftDays(todo, graph, policy);
    const projectedDue = dueMs + (shiftDays * DAY_MS);
    if (projectedDue < nowMs) count += 1;
  });
  return count;
}

function makeDryRunHash(payload) {
  const text = JSON.stringify(payload);
  return `journeyparamdry_${crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 24)}`;
}

async function resolveTargetLineUserIds(scope, deps) {
  const payload = scope && typeof scope === 'object' ? scope : {};
  const explicit = Array.isArray(payload.lineUserIds)
    ? Array.from(new Set(payload.lineUserIds.map((item) => normalizeString(item)).filter(Boolean)))
    : [];
  if (explicit.length > 0) return explicit.slice(0, 500);

  const users = await (deps.usersRepo || usersRepo).listUsers({
    scenarioKey: payload.scenarioKey || payload.scenario,
    stepKey: payload.stepKey,
    region: payload.region,
    limit: normalizeLimit(payload.limit, 200, 500)
  });
  return Array.from(new Set((users || []).map((user) => normalizeString(user && (user.id || user.lineUserId))).filter(Boolean))).slice(0, 500);
}

async function runJourneyParamDryRun(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const versionsRepo = resolvedDeps.journeyParamVersionsRepo || journeyParamVersionsRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;
  const planResolver = resolvedDeps.resolvePlan || resolvePlan;

  const versionId = normalizeString(payload.versionId);
  if (!versionId) throw new Error('versionId required');
  const version = payload.version || await versionsRepo.getJourneyParamVersion(versionId);
  if (!version) throw new Error('journey_param_version_not_found');

  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();
  const horizonDays = normalizeLimit(payload.horizonDays, 30, 180);
  const scope = payload.scope && typeof payload.scope === 'object' ? payload.scope : {};

  const lineUserIds = await resolveTargetLineUserIds(scope, resolvedDeps);
  const perUser = [];
  let impactedUsers = 0;
  let additionalNotifications = 0;
  let disabledNodes = 0;
  let deadlineBreachForecast = 0;

  for (const lineUserId of lineUserIds) {
    // eslint-disable-next-line no-await-in-loop
    const planInfo = await planResolver(lineUserId, resolvedDeps).catch(() => ({ plan: 'free' }));
    const planTier = resolvePlanTier(planInfo);

    // eslint-disable-next-line no-await-in-loop
    const baselineResolved = await resolveEffectiveJourneyParams({ lineUserId }, resolvedDeps);
    // eslint-disable-next-line no-await-in-loop
    const candidateResolved = await resolveEffectiveJourneyParams({ lineUserId, versionId }, resolvedDeps);

    // eslint-disable-next-line no-await-in-loop
    const todos = await todoRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 500 }).catch(() => []);

    const baselineUnlocked = collectUnlockedNodeKeys(baselineResolved.effective.graph, planTier);
    const candidateUnlocked = collectUnlockedNodeKeys(candidateResolved.effective.graph, planTier);
    let disabledForUser = 0;
    baselineUnlocked.forEach((key) => {
      if (!candidateUnlocked.has(key)) disabledForUser += 1;
    });

    const baselineNotif = estimateAdditionalNotifications(
      todos,
      baselineResolved.effective.graph,
      baselineResolved.effective.journeyPolicy,
      nowMs,
      horizonDays,
      planTier
    );
    const candidateNotif = estimateAdditionalNotifications(
      todos,
      candidateResolved.effective.graph,
      candidateResolved.effective.journeyPolicy,
      nowMs,
      horizonDays,
      planTier
    );

    const notifDelta = Math.max(0, candidateNotif - baselineNotif);

    const baselineBreach = estimateDeadlineBreachForecast(
      todos,
      baselineResolved.effective.graph,
      baselineResolved.effective.journeyPolicy,
      nowMs
    );
    const candidateBreach = estimateDeadlineBreachForecast(
      todos,
      candidateResolved.effective.graph,
      candidateResolved.effective.journeyPolicy,
      nowMs
    );
    const breachDelta = Math.max(0, candidateBreach - baselineBreach);

    const changed = disabledForUser > 0 || notifDelta > 0 || breachDelta > 0;
    if (changed) impactedUsers += 1;
    additionalNotifications += notifDelta;
    disabledNodes += disabledForUser;
    deadlineBreachForecast += breachDelta;

    perUser.push({
      lineUserId,
      plan: planTier,
      disabledNodes: disabledForUser,
      additionalNotifications: notifDelta,
      deadlineBreachForecast: breachDelta,
      baseline: {
        unlockedNodes: baselineUnlocked.size,
        reminderCandidates: baselineNotif,
        deadlineBreachForecast: baselineBreach
      },
      candidate: {
        unlockedNodes: candidateUnlocked.size,
        reminderCandidates: candidateNotif,
        deadlineBreachForecast: candidateBreach
      }
    });
  }

  const metrics = {
    impactedUsers,
    additionalNotifications,
    disabledNodes,
    deadlineBreachForecast,
    scannedUsers: lineUserIds.length,
    horizonDays
  };

  const dryRun = {
    ok: true,
    versionId,
    generatedAt: new Date(nowMs).toISOString(),
    scope: {
      lineUserIds,
      scenarioKey: normalizeString(scope.scenarioKey || scope.scenario) || null,
      stepKey: normalizeString(scope.stepKey) || null,
      region: normalizeString(scope.region) || null,
      limit: normalizeLimit(scope.limit, 200, 500)
    },
    metrics,
    perUser: perUser.slice(0, 200)
  };
  dryRun.hash = makeDryRunHash({ versionId, metrics, scope: dryRun.scope, generatedAt: dryRun.generatedAt });
  return dryRun;
}

module.exports = {
  runJourneyParamDryRun,
  makeDryRunHash
};
