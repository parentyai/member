'use strict';

const { normalizeState, normalizeCity, buildRegionKey } = require('../../domain/regionNormalization');
const { normalizeString, toMillis } = require('./utils');

const SEVERITY_RANK = Object.freeze({
  INFO: 1,
  WARN: 2,
  CRITICAL: 3
});

function normalizeSeverity(value, fallback) {
  const raw = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (raw === 'INFO' || raw === 'WARN' || raw === 'CRITICAL') return raw;
  return fallback || 'WARN';
}

function normalizeEventType(value) {
  const normalized = normalizeString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function resolveEmergencyEventType(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const category = normalizeString(payload.category) ? String(payload.category).trim().toLowerCase() : 'alert';
  const diffType = normalizeString(payload.diffType) ? String(payload.diffType).trim().toLowerCase() : 'update';
  return `${category}.${diffType}`;
}

function toRegionKeyFromRuleRegion(region) {
  const payload = region && typeof region === 'object' ? region : {};
  if (normalizeString(payload.regionKey)) return normalizeString(payload.regionKey);
  const state = normalizeState(payload.state);
  const city = normalizeCity(payload.city);
  if (state && city) {
    return buildRegionKey(state, city);
  }
  if (state) return `${state}::statewide`;
  return null;
}

function ruleHasUnsupportedRegionDimension(region) {
  const payload = region && typeof region === 'object' ? region : {};
  if (normalizeString(payload.county)) return 'county';
  if (normalizeString(payload.zip)) return 'zip';
  return null;
}

function severityMatch(ruleSeverity, inputSeverity) {
  const target = normalizeSeverity(inputSeverity, 'WARN');
  const expected = typeof ruleSeverity === 'string' ? ruleSeverity.trim().toUpperCase() : 'ANY';
  if (expected === 'ANY') return true;
  if (expected === target) return true;
  if (expected.endsWith('+')) {
    const base = expected.slice(0, -1);
    return (SEVERITY_RANK[target] || 0) >= (SEVERITY_RANK[base] || 0);
  }
  return false;
}

function normalizeRuleForMatch(rule) {
  const payload = rule && typeof rule === 'object' ? rule : {};
  return {
    id: normalizeString(payload.ruleId) || normalizeString(payload.id) || null,
    providerKey: normalizeString(payload.providerKey) ? payload.providerKey.trim().toLowerCase() : null,
    eventType: normalizeEventType(payload.eventType),
    severity: typeof payload.severity === 'string' ? payload.severity.trim().toUpperCase() : 'ANY',
    region: payload.region && typeof payload.region === 'object'
      ? payload.region
      : (normalizeString(payload.region) ? { regionKey: normalizeString(payload.region) } : null),
    membersOnly: payload.membersOnly === true,
    role: normalizeString(payload.role) ? payload.role.trim().toLowerCase() : null,
    autoSend: payload.autoSend === true,
    enabled: payload.enabled === true,
    priority: normalizeString(payload.priority) ? payload.priority.trim().toLowerCase() : 'emergency',
    maxRecipients: Number.isFinite(Number(payload.maxRecipients)) ? Math.floor(Number(payload.maxRecipients)) : null,
    updatedAt: payload.updatedAt || null
  };
}

function matchEmergencyRule(rule, input) {
  const normalizedRule = normalizeRuleForMatch(rule);
  const payload = input && typeof input === 'object' ? input : {};
  const providerKey = normalizeString(payload.providerKey) ? payload.providerKey.trim().toLowerCase() : null;
  const eventType = normalizeEventType(payload.eventType || resolveEmergencyEventType(payload));
  const severity = normalizeSeverity(payload.severity, 'WARN');
  const regionKey = normalizeString(payload.regionKey);

  if (!normalizedRule.enabled) {
    return { ok: false, reason: 'rule_disabled', rule: normalizedRule };
  }

  if (normalizedRule.providerKey && normalizedRule.providerKey !== providerKey) {
    return { ok: false, reason: 'provider_mismatch', rule: normalizedRule };
  }

  if (normalizedRule.eventType && normalizedRule.eventType !== eventType) {
    return { ok: false, reason: 'event_type_mismatch', rule: normalizedRule };
  }

  if (!severityMatch(normalizedRule.severity, severity)) {
    return { ok: false, reason: 'severity_mismatch', rule: normalizedRule };
  }

  if (normalizedRule.region) {
    const unsupported = ruleHasUnsupportedRegionDimension(normalizedRule.region);
    if (unsupported) {
      return {
        ok: false,
        reason: 'unsupported_target_dimension',
        unsupportedDimensions: [unsupported],
        rule: normalizedRule
      };
    }
    const expectedRegionKey = toRegionKeyFromRuleRegion(normalizedRule.region);
    if (expectedRegionKey && expectedRegionKey !== regionKey) {
      return { ok: false, reason: 'region_mismatch', rule: normalizedRule };
    }
  }

  return {
    ok: true,
    reason: 'matched',
    rule: normalizedRule
  };
}

function ruleSpecificityScore(rule) {
  const normalizedRule = normalizeRuleForMatch(rule);
  let score = 0;
  if (normalizedRule.providerKey) score += 3;
  if (normalizedRule.eventType) score += 3;
  if (normalizedRule.severity && normalizedRule.severity !== 'ANY') score += 2;
  if (normalizedRule.region) {
    if (normalizeString(normalizedRule.region.regionKey)) score += 4;
    else if (normalizeString(normalizedRule.region.state) && normalizeString(normalizedRule.region.city)) score += 3;
    else if (normalizeString(normalizedRule.region.state)) score += 2;
  }
  if (normalizedRule.membersOnly) score += 1;
  if (normalizedRule.role) score += 1;
  if (Number.isFinite(normalizedRule.maxRecipients) && normalizedRule.maxRecipients > 0) score += 1;
  return score;
}

function selectBestEmergencyRule(rules, input) {
  const list = Array.isArray(rules) ? rules : [];
  const matches = list
    .map((rule) => matchEmergencyRule(rule, input))
    .filter((entry) => entry.ok);

  if (!matches.length) {
    return {
      rule: null,
      matches: [],
      reason: 'no_matching_rule'
    };
  }

  const sorted = matches.slice().sort((left, right) => {
    const scoreDiff = ruleSpecificityScore(right.rule) - ruleSpecificityScore(left.rule);
    if (scoreDiff !== 0) return scoreDiff;
    const updatedDiff = toMillis(right.rule.updatedAt) - toMillis(left.rule.updatedAt);
    if (updatedDiff !== 0) return updatedDiff;
    return String(left.rule.id || '').localeCompare(String(right.rule.id || ''));
  });

  return {
    rule: sorted[0].rule,
    matches: sorted,
    reason: 'matched'
  };
}

module.exports = {
  normalizeSeverity,
  normalizeEventType,
  resolveEmergencyEventType,
  normalizeRuleForMatch,
  matchEmergencyRule,
  ruleSpecificityScore,
  selectBestEmergencyRule,
  toRegionKeyFromRuleRegion,
  ruleHasUnsupportedRegionDimension
};
