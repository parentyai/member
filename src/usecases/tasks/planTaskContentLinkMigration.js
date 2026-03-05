'use strict';

const stepRulesRepo = require('../../repos/firestore/stepRulesRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const taskContentLinksRepo = require('../../repos/firestore/taskContentLinksRepo');

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function normalizeManualMappings(value) {
  const rows = Array.isArray(value) ? value : [];
  const normalized = [];
  rows.forEach((row) => {
    const payload = row && typeof row === 'object' ? row : {};
    const sourceTaskKey = normalizeText(payload.sourceTaskKey || payload.taskKey, '');
    const ruleId = normalizeText(payload.ruleId, '');
    if (!sourceTaskKey || !ruleId) return;
    normalized.push({
      sourceTaskKey,
      ruleId,
      note: normalizeText(payload.note, null)
    });
  });
  return normalized;
}

async function listStepRulesForPlan(deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.stepRulesRepo || stepRulesRepo;
  const rows = await repo.listStepRules({ limit: 1000 }).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function listTaskContentsForPlan(deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.taskContentsRepo || taskContentsRepo;
  const rows = await repo.listTaskContents({ limit: 500 }).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

async function listExistingLinksForPlan(deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.taskContentLinksRepo || taskContentLinksRepo;
  if (!repo || typeof repo.listTaskContentLinks !== 'function') return [];
  const rows = await repo.listTaskContentLinks({ limit: 500 }).catch(() => []);
  return Array.isArray(rows) ? rows : [];
}

function buildManualMap(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const sourceTaskKey = normalizeText(row && row.sourceTaskKey, '');
    const ruleId = normalizeText(row && row.ruleId, '');
    if (!sourceTaskKey || !ruleId) return;
    map.set(sourceTaskKey, {
      sourceTaskKey,
      ruleId,
      note: normalizeText(row && row.note, null)
    });
  });
  return map;
}

function indexStepRules(rows) {
  const byRuleId = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const ruleId = normalizeText(row && row.ruleId, '');
    if (!ruleId) return;
    byRuleId.set(ruleId, row);
  });
  return byRuleId;
}

function buildExistingLinkIndex(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const ruleId = normalizeText(row && row.ruleId, '');
    if (!ruleId) return;
    map.set(ruleId, row);
  });
  return map;
}

async function planTaskContentLinkMigration(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const manualMappings = normalizeManualMappings(payload.manualMappings);
  const [stepRules, taskContents, existingLinks] = await Promise.all([
    listStepRulesForPlan(deps),
    listTaskContentsForPlan(deps),
    listExistingLinksForPlan(deps)
  ]);

  const stepRuleMap = indexStepRules(stepRules);
  const existingLinkMap = buildExistingLinkIndex(existingLinks);
  const manualMap = buildManualMap(manualMappings);

  const candidates = [];
  const linked = [];
  const unlinked = [];
  const warnings = [];

  taskContents.forEach((item) => {
    const taskKey = normalizeText(item && item.taskKey, '');
    if (!taskKey) return;

    let selectedRuleId = '';
    let confidence = 'strict';
    let note = null;
    let reason = '';

    if (stepRuleMap.has(taskKey)) {
      selectedRuleId = taskKey;
      confidence = 'strict';
      reason = 'strict_exact';
    } else {
      const manual = manualMap.get(taskKey);
      if (manual && stepRuleMap.has(manual.ruleId)) {
        selectedRuleId = manual.ruleId;
        confidence = 'manual';
        note = manual.note;
        reason = 'manual_map';
      }
    }

    if (!selectedRuleId) {
      unlinked.push({
        taskKey,
        reason: 'no_step_rule_link',
        title: normalizeText(item && item.title, null)
      });
      warnings.push(`unlinked taskKey: ${taskKey}`);
      return;
    }

    const existing = existingLinkMap.get(selectedRuleId);
    const currentSourceTaskKey = normalizeText(existing && existing.sourceTaskKey, null);
    const changeType = !existing
      ? 'create'
      : (currentSourceTaskKey === taskKey ? 'noop' : 'update');

    const candidate = {
      ruleId: selectedRuleId,
      sourceTaskKey: taskKey,
      status: 'active',
      confidence,
      note,
      reason,
      existingSourceTaskKey: currentSourceTaskKey,
      changeType
    };

    candidates.push(candidate);
    linked.push({
      taskKey,
      ruleId: selectedRuleId,
      confidence,
      reason,
      changeType
    });
  });

  const existingRuleIds = new Set(candidates.map((item) => item.ruleId));
  existingLinks.forEach((row) => {
    const ruleId = normalizeText(row && row.ruleId, '');
    if (!ruleId) return;
    if (existingRuleIds.has(ruleId)) return;
    const sourceTaskKey = normalizeText(row && row.sourceTaskKey, null);
    candidates.push({
      ruleId,
      sourceTaskKey,
      status: normalizeText(row && row.status, 'warn') || 'warn',
      confidence: normalizeText(row && row.confidence, 'manual') || 'manual',
      note: normalizeText(row && row.note, null),
      reason: 'existing_link_preserved',
      existingSourceTaskKey: sourceTaskKey,
      changeType: 'preserve'
    });
  });

  return {
    ok: true,
    summary: {
      stepRulesTotal: stepRules.length,
      taskContentsTotal: taskContents.length,
      linkedCount: linked.length,
      unlinkedCount: unlinked.length,
      candidateCount: candidates.length,
      manualMapCount: manualMappings.length,
      existingLinkCount: existingLinks.length
    },
    linked,
    unlinked,
    candidates,
    warnings: Array.from(new Set(warnings))
  };
}

module.exports = {
  planTaskContentLinkMigration,
  normalizeManualMappings
};
