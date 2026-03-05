'use strict';

const usersRepo = require('../../repos/firestore/usersRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const userCityPackPreferencesRepo = require('../../repos/firestore/userCityPackPreferencesRepo');
const { composeCityAndNationwidePacks } = require('../nationwidePack/composeCityAndNationwidePacks');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { isCityPackRecommendedTasksEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeModules(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return;
    if (!cityPacksRepo.ALLOWED_MODULES.includes(normalized)) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function resolveDueAtFromRule(rule, nowIso) {
  const nowMs = Date.parse(nowIso || new Date().toISOString());
  if (!Number.isFinite(nowMs)) return new Date().toISOString();
  const leadTime = rule && rule.leadTime && typeof rule.leadTime === 'object' ? rule.leadTime : {};
  const days = Number(leadTime.days);
  const safeDays = Number.isFinite(days) ? Math.max(0, Math.floor(days)) : 3;
  return new Date(nowMs + (safeDays * 24 * 60 * 60 * 1000)).toISOString();
}

async function syncCityPackRecommendedTasks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  if (!lineUserId) throw new Error('lineUserId required');
  if (!isCityPackRecommendedTasksEnabled()) {
    return {
      ok: true,
      status: 'disabled',
      createdCount: 0,
      skippedCount: 0,
      warnings: []
    };
  }

  const usersRepository = resolvedDeps.usersRepo || usersRepo;
  const tasksRepository = resolvedDeps.tasksRepo || tasksRepo;
  const stepRulesRepository = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const cityPackRepository = resolvedDeps.cityPacksRepo || cityPacksRepo;
  const preferenceRepo = resolvedDeps.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
  const composeFn = resolvedDeps.composeCityAndNationwidePacks || composeCityAndNationwidePacks;
  const nowIso = normalizeText(payload.now) || new Date().toISOString();

  const [user, pref] = await Promise.all([
    usersRepository.getUser(lineUserId).catch(() => null),
    preferenceRepo.getUserCityPackPreference(lineUserId).catch(() => null)
  ]);
  const regionKey = normalizeText(payload.regionKey || (user && user.regionKey)).toLowerCase();
  if (!regionKey) {
    return {
      ok: true,
      status: 'region_missing',
      createdCount: 0,
      skippedCount: 0,
      warnings: ['regionKey missing']
    };
  }

  const subscribedModules = normalizeModules(pref && pref.modulesSubscribed);
  const allowAllModules = subscribedModules.length === 0;
  const composition = await composeFn({
    regionKey,
    language: 'ja',
    limit: 30
  }, resolvedDeps).catch(() => ({ items: [] }));
  const items = Array.isArray(composition && composition.items) ? composition.items : [];
  const recommendations = [];
  const warnings = [];

  for (const item of items) {
    const cityPackId = normalizeText(item && item.cityPackId);
    if (!cityPackId) continue;
    // eslint-disable-next-line no-await-in-loop
    const cityPack = await cityPackRepository.getCityPack(cityPackId).catch(() => null);
    const recommendedTasks = Array.isArray(cityPack && cityPack.recommendedTasks) ? cityPack.recommendedTasks : [];
    recommendedTasks.forEach((entry) => {
      const ruleId = normalizeText(entry && entry.ruleId);
      if (!ruleId) return;
      const module = normalizeText(entry && entry.module).toLowerCase();
      if (module && !allowAllModules && !subscribedModules.includes(module)) return;
      if (recommendations.some((row) => row.ruleId === ruleId)) return;
      recommendations.push({
        ruleId,
        cityPackId,
        module: module || null
      });
    });
  }

  let createdCount = 0;
  let skippedCount = 0;
  for (const rec of recommendations) {
    const taskId = tasksRepository.buildTaskId(lineUserId, rec.ruleId);
    if (!taskId) {
      skippedCount += 1;
      warnings.push(`invalid taskId:${rec.ruleId}`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const existing = await tasksRepository.getTask(taskId).catch(() => null);
    if (existing) {
      skippedCount += 1;
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const rule = await stepRulesRepository.getStepRule(rec.ruleId).catch(() => null);
    if (!rule || rule.enabled !== true) {
      skippedCount += 1;
      warnings.push(`step_rule_missing_or_disabled:${rec.ruleId}`);
      continue;
    }
    const dueAt = resolveDueAtFromRule(rule, nowIso);
    // eslint-disable-next-line no-await-in-loop
    await tasksRepository.upsertTask(taskId, {
      taskId,
      userId: lineUserId,
      lineUserId,
      ruleId: rec.ruleId,
      stepKey: rule.stepKey || null,
      meaning: rule.meaning || null,
      status: 'todo',
      dueAt,
      nextNudgeAt: dueAt,
      blockedReason: null,
      sourceEvent: {
        eventId: null,
        eventKey: 'city_pack_recommended_task_seed',
        source: rec.cityPackId || 'city_pack',
        occurredAt: nowIso
      },
      priority: Number.isFinite(Number(rule.priority)) ? Number(rule.priority) : 100,
      riskLevel: rule.riskLevel || 'medium',
      checkedAt: nowIso,
      engineVersion: 'task_engine_v1'
    });
    createdCount += 1;
  }

  await appendAuditLog({
    actor: payload.actor || 'city_pack_recommended_task_sync',
    action: 'city_pack.recommended_tasks.sync',
    entityType: 'city_pack',
    entityId: lineUserId,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      lineUserId,
      regionKey,
      createdCount,
      skippedCount,
      recommendationCount: recommendations.length,
      warningCount: warnings.length
    }
  }).catch(() => null);

  return {
    ok: true,
    status: 'synced',
    lineUserId,
    regionKey,
    createdCount,
    skippedCount,
    warnings: Array.from(new Set(warnings))
  };
}

module.exports = {
  syncCityPackRecommendedTasks
};

