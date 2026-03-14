'use strict';

const crypto = require('node:crypto');
const {
  normalizeText,
  normalizeBacklogStatus,
  normalizeBacklogPriority,
  normalizeIssueProvenance,
  normalizeStringList,
  normalizeIssueSeverity
} = require('./issueModel');

const PRIORITY_RANK = Object.freeze({
  p0: 0,
  p1: 1,
  p2: 2,
  p3: 3
});

function toIso(value, fallback) {
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  return fallback;
}

function normalizeLooseList(values, limit) {
  const rows = Array.isArray(values) ? values : (values ? [values] : []);
  const out = [];
  const seen = new Set();
  rows.forEach((item) => {
    if (out.length >= limit) return;
    const normalized = typeof item === 'string'
      ? normalizeText(item)
      : (item && typeof item === 'object' && !Array.isArray(item) ? Object.assign({}, item) : null);
    if (!normalized) return;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function pickHigherPriority(left, right) {
  const a = normalizeBacklogPriority(left);
  const b = normalizeBacklogPriority(right);
  return PRIORITY_RANK[a] <= PRIORITY_RANK[b] ? a : b;
}

function normalizePriority(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicitRaw = normalizeText(payload.priority).toLowerCase();
  if (['p0', 'p1', 'p2', 'p3'].includes(explicitRaw)) return explicitRaw;
  const severities = Array.isArray(payload.issueSeverities) ? payload.issueSeverities : [];
  if (severities.some((item) => normalizeIssueSeverity(item) === 'critical')) return 'p0';
  if (severities.some((item) => normalizeIssueSeverity(item) === 'high')) return 'p1';
  if (severities.some((item) => normalizeIssueSeverity(item) === 'medium')) return 'p2';
  return payload.observationBlocker === true ? 'p1' : 'p2';
}

function buildBacklogId(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const issueIds = normalizeStringList(payload.issueIds, { limit: 16 }).sort((a, b) => a.localeCompare(b));
  const proposedPrName = normalizeText(payload.proposedPrName).toLowerCase();
  const objective = normalizeText(payload.objective).toLowerCase();
  const seed = proposedPrName
    ? [proposedPrName, objective].join('|')
    : [objective, issueIds.join('|')].join('|');
  const digest = crypto.createHash('sha256').update(seed || 'quality_backlog', 'utf8').digest('hex').slice(0, 24);
  return payload.backlogId || `qib_${digest}`;
}

function buildBacklogRecord(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nowIso = new Date().toISOString();
  const createdAt = toIso(payload.createdAt, nowIso);
  const issueIds = normalizeStringList(payload.issueIds, { limit: 16 });
  return {
    backlogId: buildBacklogId(payload),
    createdAt,
    updatedAt: toIso(payload.updatedAt, createdAt),
    status: normalizeBacklogStatus(payload.status),
    priority: normalizePriority(payload),
    issueIds,
    proposedPrName: normalizeText(payload.proposedPrName) || 'PR-Quality-Patrol-Improvement',
    objective: normalizeText(payload.objective) || 'quality patrol improvement backlog item',
    whyNow: normalizeText(payload.whyNow) || null,
    targetFiles: normalizeStringList(payload.targetFiles, { limit: 24 }),
    expectedKpiMovement: normalizeLooseList(payload.expectedKpiMovement, 12),
    risk: normalizeText(payload.risk) || null,
    rollbackPlan: normalizeText(payload.rollbackPlan) || null,
    dependency: normalizeStringList(payload.dependency, { limit: 12 }),
    owner: normalizeText(payload.owner) || null,
    provenance: normalizeIssueProvenance(payload.provenance)
  };
}

module.exports = {
  PRIORITY_RANK,
  pickHigherPriority,
  normalizePriority,
  buildBacklogId,
  buildBacklogRecord
};
