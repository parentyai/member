'use strict';

const cityPacksRepo = require('../../repos/firestore/cityPacksRepo');
const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const tasksRepo = require('../../repos/firestore/tasksRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { isCityPackRecommendedTasksEnabled } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeRegionKey(value) {
  return normalizeText(value).toLowerCase();
}

function normalizeRecommendedTasks(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const ruleId = normalizeText(row.ruleId);
    if (!ruleId) continue;
    const module = normalizeText(row.module).toLowerCase() || null;
    const priorityBoost = Number.isFinite(Number(row.priorityBoost)) ? Number(row.priorityBoost) : null;
    out.push({ ruleId, module, priorityBoost });
  }
  return out;
}

function cityPackMatchesRegion(pack, regionKey) {
  const row = pack && typeof pack === 'object' ? pack : {};
  const target = normalizeRegionKey(regionKey);
  if (!target) return false;
  const metadata = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const primary = normalizeRegionKey(row.regionKey || metadata.regionKey);
  if (primary && primary === target) return true;
  const keys = Array.isArray(metadata.regionKeys) ? metadata.regionKeys : [];
  return keys.some((item) => normalizeRegionKey(item) === target);
}

function resolveDueAt(days) {
  const now = Date.now();
  const safeDays = Number.isFinite(Number(days)) ? Math.max(0, Math.min(180, Math.floor(Number(days)))) : 14;
  return new Date(now + safeDays * 24 * 60 * 60 * 1000).toISOString();
}

async function syncCityPackRecommendedTasks(params, deps) {
  if (!isCityPackRecommendedTasksEnabled()) {
    return { ok: true, status: 'disabled', seededCount: 0, skippedCount: 0 };
  }
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const lineUserId = normalizeText(payload.lineUserId);
  const regionKey = normalizeRegionKey(payload.regionKey);
  if (!lineUserId || !regionKey) {
    return { ok: false, status: 'invalid_params', seededCount: 0, skippedCount: 0 };
  }

  const cpRepo = resolvedDeps.cityPacksRepo || cityPacksRepo;
  const srRepo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const tsRepo = resolvedDeps.tasksRepo || tasksRepo;
  const todoRepo = resolvedDeps.journeyTodoItemsRepo || journeyTodoItemsRepo;

  const packs = await cpRepo.listCityPacks({ activeOnly: true, limit: 200 }).catch(() => []);
  const candidates = (Array.isArray(packs) ? packs : []).filter((pack) => cityPackMatchesRegion(pack, regionKey));
  const seededRuleIds = new Set();
  let seededCount = 0;
  let skippedCount = 0;

  for (const pack of candidates) {
    const recommendedTasks = normalizeRecommendedTasks(pack.recommendedTasks);
    for (const item of recommendedTasks) {
      if (seededRuleIds.has(item.ruleId)) continue;
      // eslint-disable-next-line no-await-in-loop
      const rule = await srRepo.getStepRule(item.ruleId).catch(() => null);
      if (!rule || rule.enabled !== true) {
        skippedCount += 1;
        continue;
      }
      const taskId = tasksRepo.buildTaskId(lineUserId, item.ruleId);
      // eslint-disable-next-line no-await-in-loop
      const existing = await tsRepo.getTask(taskId).catch(() => null);
      if (!existing) {
        // eslint-disable-next-line no-await-in-loop
        await tsRepo.upsertTask(taskId, {
          userId: lineUserId,
          lineUserId,
          ruleId: item.ruleId,
          status: 'todo',
          dueAt: resolveDueAt(item.priorityBoost && item.priorityBoost > 0 ? 7 : 14),
          nextNudgeAt: new Date().toISOString(),
          blockedReason: null,
          stepKey: rule.stepKey || null,
          meaning: rule.meaning || null,
          sourceEvent: {
            eventId: null,
            eventKey: 'CITY_PACK_RECOMMENDED',
            source: 'city_pack',
            occurredAt: new Date().toISOString()
          },
          explain: [{
            decisionKey: 'seed_city_pack_recommended',
            cityPackId: pack.id,
            regionKey
          }]
        });
        seededCount += 1;
      }
      // eslint-disable-next-line no-await-in-loop
      await todoRepo.upsertJourneyTodoItem(lineUserId, item.ruleId, {
        title: (rule.meaning && rule.meaning.title) || rule.stepKey || item.ruleId,
        dueAt: resolveDueAt(item.priorityBoost && item.priorityBoost > 0 ? 7 : 14),
        status: 'open',
        progressState: 'not_started',
        graphStatus: 'actionable',
        journeyState: 'planned',
        source: 'city_pack_recommended'
      }).catch(() => null);
      seededRuleIds.add(item.ruleId);
    }
  }

  return {
    ok: true,
    status: 'ok',
    seededCount,
    skippedCount,
    matchedCityPackCount: candidates.length
  };
}

module.exports = {
  syncCityPackRecommendedTasks
};
