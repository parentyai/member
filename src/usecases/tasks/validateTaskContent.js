'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const taskContentsRepo = require('../../repos/firestore/taskContentsRepo');
const { TASK_CATEGORY_VALUES } = require('../../domain/tasks/usExpatTaxonomy');
const { getTaskDependencyMax } = require('../../domain/tasks/featureFlags');
const { isTaskMicroLearningEnabled } = require('../../domain/tasks/featureFlags');

const TASK_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{1,63}$/;

function normalizeText(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim();
  return normalized || fallback;
}

function isHealthyLink(link) {
  if (!link || typeof link !== 'object') return false;
  if (link.enabled === false) return false;
  const state = link.lastHealth && typeof link.lastHealth.state === 'string'
    ? link.lastHealth.state.trim().toUpperCase()
    : '';
  if (state === 'WARN') return false;
  const url = normalizeText(link.url, '');
  if (!url) return false;
  return /^https?:\/\//i.test(url);
}

function inferLinkKind(link) {
  const explicit = normalizeText(link && link.kind, '').toLowerCase();
  if (explicit) return explicit;
  const url = normalizeText(link && link.url, '').toLowerCase();
  if (!url) return 'web';
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.startsWith('https://liff.line.me') || url.startsWith('line://')) return 'liff';
  return 'web';
}

function validateTaskContent(payload) {
  const normalized = taskContentsRepo.normalizeTaskContent(payload && payload.taskKey, payload || {});
  const errors = [];
  const warnings = [];
  if (!normalized) {
    errors.push('taskKey required');
    return { ok: false, errors, warnings, normalized: null };
  }
  if (normalized.timeMin !== null && normalized.timeMax !== null && normalized.timeMin > normalized.timeMax) {
    errors.push('timeMin must be <= timeMax');
  }
  if (normalized.category && !TASK_CATEGORY_VALUES.includes(String(normalized.category).toUpperCase())) {
    errors.push('category invalid');
  }
  if (Array.isArray(normalized.dependencies) && normalized.dependencies.length > getTaskDependencyMax()) {
    errors.push(`dependencies max ${getTaskDependencyMax()}`);
  }
  if (Array.isArray(normalized.recommendedVendorLinkIds) && normalized.recommendedVendorLinkIds.length > 3) {
    errors.push('recommendedVendorLinkIds max 3');
  }
  if (Array.isArray(normalized.checklist) && normalized.checklist.length > 50) {
    warnings.push('checklist truncated to 50 recommended');
  }
  if (Array.isArray(normalized.checklistItems) && normalized.checklistItems.length > 20) {
    warnings.push('checklistItems truncated to 20 recommended');
  }
  if (isTaskMicroLearningEnabled()) {
    const summaryShort = Array.isArray(normalized.summaryShort) ? normalized.summaryShort : [];
    const topMistakes = Array.isArray(normalized.topMistakes) ? normalized.topMistakes : [];
    const contextTips = Array.isArray(normalized.contextTips) ? normalized.contextTips : [];
    if (summaryShort.length > 5) errors.push('summaryShort max 5');
    if (topMistakes.length > 3) errors.push('topMistakes max 3');
    if (contextTips.length > 5) errors.push('contextTips max 5');
    if (summaryShort.some((item) => !normalizeText(item, ''))) errors.push('summaryShort requires non-empty text');
    if (topMistakes.some((item) => !normalizeText(item, ''))) errors.push('topMistakes requires non-empty text');
    if (contextTips.some((item) => !normalizeText(item, ''))) errors.push('contextTips requires non-empty text');
  }
  if (!normalizeText(normalized.manualText, '')) warnings.push('manualText missing');
  if (!normalizeText(normalized.failureText, '')) warnings.push('failureText missing');
  return {
    ok: errors.length === 0,
    errors,
    warnings,
    normalized
  };
}

async function resolveTaskKeyWarnings(taskContent, deps) {
  const warnings = [];
  const normalized = taskContentsRepo.normalizeTaskContent(taskContent && taskContent.taskKey, taskContent || {});
  if (!normalized || !normalized.taskKey) {
    warnings.push('taskKey missing');
    return warnings;
  }
  const taskKey = normalizeText(normalized.taskKey, '');
  if (!TASK_KEY_PATTERN.test(taskKey)) {
    warnings.push('taskKey should match [a-z0-9][a-z0-9_-]{1,63}');
  }
  if (taskKey.includes('__')) {
    warnings.push('taskKey includes "__" and may be runtime todo composite');
  }
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const stepRuleRepo = resolvedDeps.stepRulesRepo;
  if (stepRuleRepo && typeof stepRuleRepo.getStepRule === 'function') {
    const linkedRule = await stepRuleRepo.getStepRule(taskKey).catch(() => null);
    if (!linkedRule) {
      warnings.push('taskKey is not linked to step_rules.ruleId (todoKey fallback only)');
    }
  }
  return Array.from(new Set(warnings));
}

async function resolveTaskContentLinks(taskContent, deps) {
  const content = taskContent && typeof taskContent === 'object' ? taskContent : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const linkRepo = resolvedDeps.linkRegistryRepo || linkRegistryRepo;

  const out = {
    video: { ok: false, id: null, link: null, reason: 'missing_link_id' },
    action: { ok: false, id: null, link: null, reason: 'missing_link_id' },
    warnings: []
  };

  const pairs = [
    { key: 'video', id: normalizeText(content.videoLinkId, null) },
    { key: 'action', id: normalizeText(content.actionLinkId, null) }
  ];

  for (const pair of pairs) {
    if (!pair.id) continue;
    const row = { ok: false, id: pair.id, link: null, reason: 'not_found' };
    // eslint-disable-next-line no-await-in-loop
    const link = await linkRepo.getLink(pair.id);
    if (!link) {
      out[pair.key] = row;
      out.warnings.push(`${pair.key} link not found`);
      continue;
    }
    row.link = link;
    if (!isHealthyLink(link)) {
      row.reason = 'invalid_or_warn';
      out[pair.key] = row;
      out.warnings.push(`${pair.key} link disabled or unhealthy`);
      continue;
    }
    const kind = inferLinkKind(link);
    if (pair.key === 'video' && kind !== 'youtube') {
      row.reason = 'video_kind_invalid';
      out[pair.key] = row;
      out.warnings.push('video link should be youtube');
      continue;
    }
    row.ok = true;
    row.reason = null;
    row.kind = kind;
    out[pair.key] = row;
  }

  return out;
}

module.exports = {
  validateTaskContent,
  resolveTaskKeyWarnings,
  resolveTaskContentLinks,
  isHealthyLink,
  inferLinkKind
};
