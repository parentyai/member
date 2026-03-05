'use strict';

const linkRegistryRepo = require('../../repos/firestore/linkRegistryRepo');
const { TASK_CATEGORY_VALUES } = require('../../domain/tasks/usExpatTaxonomy');
const { getTaskDependencyMax } = require('../../domain/tasks/featureFlags');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeStringList(value, limit) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const row of value) {
    const normalized = normalizeText(row);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
    if (Number.isFinite(limit) && out.length >= limit) break;
  }
  return out;
}

function buildIssue(level, field, code, message) {
  return { level, field, code, message };
}

function isWarnOrDisabled(link) {
  if (!link || typeof link !== 'object') return true;
  if (link.enabled === false) return true;
  const state = link.lastHealth && typeof link.lastHealth.state === 'string'
    ? link.lastHealth.state.trim().toUpperCase()
    : '';
  return state === 'WARN' || state === 'BLOCKED';
}

function inferLinkKind(link) {
  if (!link || typeof link !== 'object') return 'unknown';
  const explicit = normalizeText(link.kind || link.intentTag).toLowerCase();
  if (explicit) return explicit;
  const url = normalizeText(link.url).toLowerCase();
  if (url.includes('youtube.com') || url.includes('youtu.be')) return 'youtube';
  if (url.startsWith('https://liff.line.me/')) return 'liff';
  return 'web';
}

async function validateTaskContent(input, deps) {
  const payload = input && typeof input === 'object' ? input : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const getLink = resolvedDeps.getLink || linkRegistryRepo.getLink;

  const errors = [];
  const warnings = [];

  const taskKey = normalizeText(payload.taskKey);
  if (!taskKey) {
    errors.push(buildIssue('error', 'taskKey', 'required', 'taskKey is required'));
  }

  const category = normalizeText(payload.category).toUpperCase();
  if (category && !TASK_CATEGORY_VALUES.includes(category)) {
    errors.push(buildIssue('error', 'category', 'invalid_enum', 'category is invalid'));
  }

  const dependencyLimit = getTaskDependencyMax();
  const dependencies = normalizeStringList(payload.dependencies, dependencyLimit + 20);
  if (dependencies.length > dependencyLimit) {
    errors.push(buildIssue('error', 'dependencies', 'max_exceeded', `dependencies must be <= ${dependencyLimit}`));
  }

  const summaryShort = normalizeStringList(payload.summaryShort, 20);
  if (summaryShort.length > 5) {
    errors.push(buildIssue('error', 'summaryShort', 'max_exceeded', 'summaryShort must be <= 5 items'));
  }
  const topMistakes = normalizeStringList(payload.topMistakes, 20);
  if (topMistakes.length > 3) {
    errors.push(buildIssue('error', 'topMistakes', 'max_exceeded', 'topMistakes must be <= 3 items'));
  }
  const contextTips = normalizeStringList(payload.contextTips, 20);
  if (contextTips.length > 5) {
    errors.push(buildIssue('error', 'contextTips', 'max_exceeded', 'contextTips must be <= 5 items'));
  }

  const videoLinkId = normalizeText(payload.videoLinkId);
  const actionLinkId = normalizeText(payload.actionLinkId);
  const recommendedVendorLinkIds = normalizeStringList(payload.recommendedVendorLinkIds, 20);
  if (recommendedVendorLinkIds.length > 3) {
    errors.push(buildIssue('error', 'recommendedVendorLinkIds', 'max_exceeded', 'recommendedVendorLinkIds must be <= 3 items'));
  }

  async function checkLink(linkId, field, opts) {
    if (!linkId) return null;
    const link = await getLink(linkId).catch(() => null);
    if (!link) {
      warnings.push(buildIssue('warn', field, 'not_found', `${field} link not found`));
      return null;
    }
    if (isWarnOrDisabled(link)) {
      warnings.push(buildIssue('warn', field, 'inactive', `${field} link is WARN/disabled`));
      return link;
    }
    const kind = inferLinkKind(link);
    if (opts && opts.requireKind && kind !== opts.requireKind) {
      warnings.push(buildIssue('warn', field, 'kind_mismatch', `${field} expects ${opts.requireKind}`));
    }
    return link;
  }

  // eslint-disable-next-line no-await-in-loop
  const videoLink = await checkLink(videoLinkId, 'videoLinkId', { requireKind: 'youtube' });
  // eslint-disable-next-line no-await-in-loop
  const actionLink = await checkLink(actionLinkId, 'actionLinkId');
  for (const vendorLinkId of recommendedVendorLinkIds) {
    // eslint-disable-next-line no-await-in-loop
    await checkLink(vendorLinkId, 'recommendedVendorLinkIds');
  }

  if (!normalizeText(payload.manualText)) {
    warnings.push(buildIssue('warn', 'manualText', 'empty', 'manualText is empty'));
  }
  if (!normalizeText(payload.failureText)) {
    warnings.push(buildIssue('warn', 'failureText', 'empty', 'failureText is empty'));
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    resolved: {
      videoLinkId: videoLink && !isWarnOrDisabled(videoLink) ? videoLinkId : null,
      actionLinkId: actionLink && !isWarnOrDisabled(actionLink) ? actionLinkId : null
    }
  };
}

module.exports = {
  validateTaskContent
};
