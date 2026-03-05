'use strict';

const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const usersRepo = require('../../repos/firestore/usersRepo');
const userCityPackPreferencesRepo = require('../../repos/firestore/userCityPackPreferencesRepo');
const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const { listUserTasks } = require('./listUserTasks');
const { composeCityAndNationwidePacks } = require('../nationwidePack/composeCityAndNationwidePacks');
const { computeDailyTopTasks } = require('./computeDailyTopTasks');
const { normalizeTaskCategory } = require('../../domain/tasks/taskCategories');
const {
  isNextTaskEngineEnabled,
  isCityPackRecommendedTasksEnabled,
  getJourneyNextTaskMax
} = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return getJourneyNextTaskMax();
  return Math.max(1, Math.min(Math.floor(parsed), getJourneyNextTaskMax()));
}

function normalizeCityPackModules(values) {
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

function toPriorityScore(task, rule, boost) {
  const taskPriority = Number(task && task.priorityScore);
  const rulePriority = Number(rule && rule.priority);
  const base = Number.isFinite(taskPriority)
    ? Math.max(0, Math.floor(taskPriority))
    : (Number.isFinite(rulePriority) ? Math.max(0, Math.floor(rulePriority)) : 100);
  const adjusted = base - Math.max(0, Number(boost) || 0);
  return Math.max(0, adjusted);
}

async function buildRuleMap(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const repo = payload.stepRulesRepo || stepRulesRepo;
  if (Array.isArray(payload.stepRules)) {
    return new Map(payload.stepRules
      .filter((item) => item && item.ruleId)
      .map((item) => [item.ruleId, item]));
  }
  const rules = await repo.listStepRules({ limit: 1000 }).catch(() => []);
  return new Map(rules.filter((item) => item && item.ruleId).map((item) => [item.ruleId, item]));
}

async function buildCityPackBoostMap(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (!isCityPackRecommendedTasksEnabled()) return new Map();
  const userId = normalizeText(payload.lineUserId || payload.userId);
  if (!userId) return new Map();

  const usersRepository = payload.usersRepo || usersRepo;
  const preferenceRepo = payload.userCityPackPreferencesRepo || userCityPackPreferencesRepo;
  const cityPackRepository = payload.cityPacksRepo || cityPacksRepo;
  const composeFn = payload.composeCityAndNationwidePacks || composeCityAndNationwidePacks;

  const [user, pref] = await Promise.all([
    usersRepository.getUser(userId).catch(() => null),
    preferenceRepo.getUserCityPackPreference(userId).catch(() => null)
  ]);
  const regionKey = normalizeText(user && user.regionKey).toLowerCase();
  if (!regionKey) return new Map();

  const modulesSubscribed = normalizeCityPackModules(pref && pref.modulesSubscribed);
  const moduleAllowAll = modulesSubscribed.length === 0;

  const composition = await composeFn({
    regionKey,
    language: 'ja',
    limit: 30
  }, payload).catch(() => ({ items: [] }));
  const items = Array.isArray(composition && composition.items) ? composition.items : [];
  const boosts = new Map();
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
      if (module && !moduleAllowAll && !modulesSubscribed.includes(module)) return;
      const boost = Number(entry && entry.priorityBoost);
      const safeBoost = Number.isFinite(boost) ? Math.max(0, Math.floor(boost)) : 0;
      const current = boosts.get(ruleId) || 0;
      if (safeBoost > current) boosts.set(ruleId, safeBoost);
    });
  }
  return boosts;
}

async function computeNextTasks(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId || payload.userId);
  if (!lineUserId) throw new Error('lineUserId required');

  if (!isNextTaskEngineEnabled()) {
    return {
      ok: true,
      engineEnabled: false,
      lineUserId,
      tasks: []
    };
  }

  const limit = normalizeLimit(payload.limit);
  const taskRows = Array.isArray(payload.tasks)
    ? payload.tasks
    : (await listUserTasks({
      lineUserId,
      userId: lineUserId,
      limit: payload.taskLimit || 200,
      actor: payload.actor || 'compute_next_tasks'
    }, resolvedDeps).catch(() => ({ tasks: [] }))).tasks || [];
  const ruleMap = await buildRuleMap(Object.assign({}, resolvedDeps, payload));
  const boostMap = await buildCityPackBoostMap(Object.assign({}, resolvedDeps, payload, { lineUserId }));
  const categoryFilter = normalizeTaskCategory(payload.category, null);

  const candidates = [];
  taskRows.forEach((task) => {
    const status = normalizeText(task && task.status).toLowerCase();
    if (!['todo', 'doing'].includes(status)) return;
    const ruleId = normalizeText(task && task.ruleId);
    const rule = ruleId ? ruleMap.get(ruleId) : null;
    const category = normalizeTaskCategory(task && task.category, normalizeTaskCategory(rule && rule.category, 'LIFE_SETUP'));
    if (categoryFilter && category !== categoryFilter) return;
    const boost = ruleId ? (boostMap.get(ruleId) || 0) : 0;
    candidates.push(Object.assign({}, task, {
      category,
      priorityScore: toPriorityScore(task, rule, boost),
      cityPackPriorityBoost: boost
    }));
  });

  const top = computeDailyTopTasks({
    tasks: candidates,
    limit,
    now: payload.now || new Date().toISOString()
  }).map((task, index) => Object.assign({}, task, { rank: index + 1 }));

  return {
    ok: true,
    engineEnabled: true,
    lineUserId,
    category: categoryFilter || null,
    totalCandidates: candidates.length,
    tasks: top
  };
}

module.exports = {
  computeNextTasks
};

