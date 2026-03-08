'use strict';

const { normalizeTaskCategory } = require('../../domain/tasks/taskCategories');

function normalizeText(value, fallback) {
  if (typeof value !== 'string') return fallback || '';
  const normalized = value.trim();
  return normalized || fallback || '';
}

function normalizeArray(values) {
  if (!Array.isArray(values)) return [];
  const out = [];
  values.forEach((value) => {
    const normalized = normalizeText(value).toLowerCase();
    if (!normalized) return;
    if (out.includes(normalized)) return;
    out.push(normalized);
  });
  return out;
}

function normalizeRegionKey(value) {
  const normalized = normalizeText(value).toLowerCase();
  return normalized || null;
}

function normalizeHealthState(candidate) {
  const row = candidate && typeof candidate === 'object' ? candidate : {};
  const state = normalizeText(row.healthState || row.lastHealthState || '').toUpperCase();
  return state || 'UNKNOWN';
}

function normalizeBoolean(value, fallback) {
  if (typeof value === 'boolean') return value;
  return fallback === true;
}

function normalizePosition(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.floor(parsed);
}

function scoreSingleCandidate(candidate, context) {
  const row = candidate && typeof candidate === 'object' ? candidate : {};
  const ctx = context && typeof context === 'object' ? context : {};
  const position = normalizePosition(row.position, 0);
  const tags = normalizeArray(row.tags);
  const modulesSubscribed = normalizeArray(ctx.modulesSubscribed);
  const category = normalizeTaskCategory(ctx.taskCategory, 'LIFE_SETUP') || 'LIFE_SETUP';
  const regionKey = normalizeRegionKey(ctx.regionKey);
  const candidateRegionKey = normalizeRegionKey(row.regionKey);
  const regionScope = normalizeText(row.regionScope).toLowerCase();
  const audienceTag = normalizeText(row.audienceTag).toLowerCase();
  const healthState = normalizeHealthState(row);
  const legacyHealthy = normalizeBoolean(row.legacyHealthy, false);

  let base = 50;
  let health = 0;
  let region = 0;
  let moduleFit = 0;
  let taskCategoryFit = 0;
  let assignmentContextFit = 0;
  let orderBias = Math.max(0, 6 - position);
  const explanationCodes = [];

  if (legacyHealthy) {
    health += 20;
    explanationCodes.push('health_ok');
  } else {
    health -= 120;
    explanationCodes.push('health_filtered');
  }
  if (healthState === 'WARN') {
    health -= 30;
    explanationCodes.push('health_warn');
  }

  if (regionKey && candidateRegionKey && regionKey === candidateRegionKey) {
    region += 18;
    explanationCodes.push('region_exact_match');
  } else if (regionScope === 'nationwide') {
    region += 8;
    explanationCodes.push('region_scope_nationwide');
  } else if (regionKey && candidateRegionKey && regionKey !== candidateRegionKey) {
    region -= 6;
    explanationCodes.push('region_mismatch');
  }

  if (category && tags.includes(category.toLowerCase())) {
    taskCategoryFit += 14;
    explanationCodes.push('task_category_tag_match');
  } else if (normalizeText(row.intentTag).toLowerCase() === 'vendor') {
    taskCategoryFit += 6;
    explanationCodes.push('intent_vendor');
  }

  if (modulesSubscribed.length > 0) {
    const moduleMatches = modulesSubscribed.filter((module) => tags.includes(module));
    if (moduleMatches.length > 0) {
      moduleFit += Math.min(12, moduleMatches.length * 6);
      explanationCodes.push('module_subscription_match');
    } else {
      moduleFit -= 4;
      explanationCodes.push('module_subscription_miss');
    }
  } else {
    explanationCodes.push('module_default_all');
  }

  const assignmentContext = ctx.assignmentContext && typeof ctx.assignmentContext === 'object'
    ? ctx.assignmentContext
    : {};
  const householdType = normalizeText(assignmentContext.householdType).toLowerCase();
  if (householdType) {
    if (audienceTag === 'family' && householdType !== 'single') {
      assignmentContextFit += 8;
      explanationCodes.push('household_family_fit');
    } else if (audienceTag === 'solo' && householdType === 'single') {
      assignmentContextFit += 8;
      explanationCodes.push('household_solo_fit');
    } else if (audienceTag === 'family' || audienceTag === 'solo') {
      assignmentContextFit -= 4;
      explanationCodes.push('household_audience_mismatch');
    }
  }
  if (normalizeText(assignmentContext.departureDate)) {
    assignmentContextFit += 2;
    explanationCodes.push('departure_date_known');
  }
  if (normalizeText(assignmentContext.assignmentDate)) {
    assignmentContextFit += 2;
    explanationCodes.push('assignment_date_known');
  }

  const relevanceScore = Math.round(base + health + region + moduleFit + taskCategoryFit + assignmentContextFit + orderBias);
  return {
    linkId: normalizeText(row.linkId),
    position,
    relevanceScore,
    legacyHealthy,
    healthState,
    scoreBreakdown: {
      base,
      health,
      region,
      moduleFit,
      taskCategoryFit,
      assignmentContextFit,
      orderBias,
      total: relevanceScore
    },
    explanationCodes: Array.from(new Set(explanationCodes))
  };
}

async function computeVendorRelevanceScore(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const scored = candidates
    .map((candidate, index) => {
      const row = candidate && typeof candidate === 'object' ? candidate : {};
      return scoreSingleCandidate(Object.assign({}, row, {
        position: normalizePosition(row.position, index)
      }), payload);
    })
    .filter((item) => item.linkId);

  const ranked = scored
    .slice()
    .sort((left, right) => {
      if (left.relevanceScore !== right.relevanceScore) return right.relevanceScore - left.relevanceScore;
      return left.position - right.position;
    });

  return {
    traceId: normalizeText(payload.traceId) || null,
    currentOrderLinkIds: scored.slice().sort((a, b) => a.position - b.position).map((item) => item.linkId),
    rankedLinkIds: ranked.map((item) => item.linkId),
    items: ranked
  };
}

module.exports = {
  computeVendorRelevanceScore
};
