'use strict';

const ISSUE_LAYERS = Object.freeze(['conversation', 'telemetry', 'trace', 'integration', 'observation']);
const ISSUE_SLICES = Object.freeze(['broad', 'housing', 'city', 'followup', 'other', 'unknown']);
const ISSUE_SEVERITIES = Object.freeze(['critical', 'high', 'medium', 'low']);
const ISSUE_STATUSES = Object.freeze(['open', 'watching', 'mitigated', 'closed']);
const ISSUE_PROVENANCE = Object.freeze(['live', 'historical', 'prepared_summary', 'unavailable']);
const BACKLOG_STATUSES = Object.freeze(['proposed', 'approved', 'in_progress', 'done', 'rejected']);
const BACKLOG_PRIORITIES = Object.freeze(['p0', 'p1', 'p2', 'p3']);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeToken(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return fallback || null;
  return normalized.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || (fallback || null);
}

function normalizeIssueLayer(value) {
  const normalized = normalizeToken(value, 'observation');
  return ISSUE_LAYERS.includes(normalized) ? normalized : 'observation';
}

function normalizeIssueCategory(value) {
  return normalizeToken(value, 'unknown_issue');
}

function normalizeIssueSlice(value) {
  const normalized = normalizeToken(value, 'unknown');
  return ISSUE_SLICES.includes(normalized) ? normalized : 'unknown';
}

function normalizeIssueSeverity(value) {
  const normalized = normalizeToken(value, '');
  return ISSUE_SEVERITIES.includes(normalized) ? normalized : null;
}

function normalizeIssueStatus(value) {
  const normalized = normalizeToken(value, '');
  return ISSUE_STATUSES.includes(normalized) ? normalized : null;
}

function normalizeIssueProvenance(value) {
  const normalized = normalizeToken(value, 'unavailable');
  return ISSUE_PROVENANCE.includes(normalized) ? normalized : 'unavailable';
}

function normalizeBacklogStatus(value) {
  const normalized = normalizeToken(value, 'proposed');
  return BACKLOG_STATUSES.includes(normalized) ? normalized : 'proposed';
}

function normalizeBacklogPriority(value) {
  const normalized = normalizeToken(value, 'p2');
  return BACKLOG_PRIORITIES.includes(normalized) ? normalized : 'p2';
}

function normalizeThreadId(value) {
  return normalizeText(value) || 'unknown';
}

function clampConfidence(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return Number.isFinite(Number(fallback)) ? Number(fallback) : 0.5;
  return Math.max(0, Math.min(1, Number(numeric)));
}

function normalizeSummary(value, fallback) {
  const normalized = normalizeText(value);
  if (normalized) return normalized.slice(0, 500);
  return normalizeText(fallback) || null;
}

function normalizeStringList(values, options) {
  const settings = options && typeof options === 'object' ? options : {};
  const rows = Array.isArray(values) ? values : [];
  const limit = Number.isFinite(Number(settings.limit)) ? Math.max(1, Math.floor(Number(settings.limit))) : 12;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= limit) return;
    const normalized = settings.transform === 'token'
      ? normalizeToken(item, '')
      : normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeRootCauseHint(value) {
  if (Array.isArray(value)) return normalizeStringList(value, { limit: 6, transform: 'token' });
  const normalized = normalizeToken(value, '');
  return normalized ? [normalized] : [];
}

function normalizeTraceRefs(value) {
  const rows = Array.isArray(value) ? value : (value ? [value] : []);
  const out = [];
  rows.forEach((item) => {
    if (out.length >= 12) return;
    if (typeof item === 'string') {
      const normalized = normalizeText(item);
      if (normalized && !out.includes(normalized)) out.push(normalized);
      return;
    }
    if (!item || typeof item !== 'object') return;
    const candidate = normalizeText(item.traceId || item.requestId || item.ref || item.id || '');
    if (candidate && !out.includes(candidate)) out.push(candidate);
  });
  return out;
}

function normalizeEvidenceItem(item) {
  if (typeof item === 'string') {
    const summary = normalizeText(item);
    return summary ? { summary } : null;
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const summary = normalizeSummary(item.summary || item.message || item.description, null);
  const signal = normalizeToken(item.signal || item.code || item.kind, '');
  const metric = normalizeToken(item.metric, '');
  const collection = normalizeToken(item.collection, '');
  const path = normalizeText(item.path);
  const traceRef = normalizeText(item.traceRef || item.traceId || item.requestId);
  const value = item.value !== undefined ? item.value : null;
  const normalized = {};
  if (signal) normalized.signal = signal;
  if (metric) normalized.metric = metric;
  if (collection) normalized.collection = collection;
  if (summary) normalized.summary = summary;
  if (path) normalized.path = path;
  if (traceRef) normalized.traceRef = traceRef;
  if (value !== null) normalized.value = value;
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeSupportingEvidence(value) {
  const rows = Array.isArray(value) ? value : (value ? [value] : []);
  const out = [];
  const seen = new Set();
  rows.forEach((item) => {
    if (out.length >= 10) return;
    const normalized = normalizeEvidenceItem(item);
    if (!normalized) return;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function normalizeMetricItem(item) {
  if (typeof item === 'string') {
    const metric = normalizeToken(item, '');
    return metric ? { metric } : null;
  }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  const metric = normalizeToken(item.metric || item.key || item.name, '');
  const normalized = {};
  if (metric) normalized.metric = metric;
  if (item.value !== undefined) normalized.value = item.value;
  if (Number.isFinite(Number(item.sampleCount))) normalized.sampleCount = Math.max(0, Math.floor(Number(item.sampleCount)));
  if (normalizeText(item.status)) normalized.status = normalizeToken(item.status, '');
  return Object.keys(normalized).length ? normalized : null;
}

function normalizeRelatedMetrics(value) {
  const rows = Array.isArray(value) ? value : (value ? [value] : []);
  const out = [];
  const seen = new Set();
  rows.forEach((item) => {
    if (out.length >= 10) return;
    const normalized = normalizeMetricItem(item);
    if (!normalized) return;
    const key = JSON.stringify(normalized);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function extractSampleCount(payload) {
  const explicit = Number(payload && payload.sampleCount);
  if (Number.isFinite(explicit) && explicit >= 0) return Math.floor(explicit);
  const metrics = normalizeRelatedMetrics(payload && payload.relatedMetrics);
  return metrics.reduce((max, item) => {
    const count = Number(item && item.sampleCount);
    if (!Number.isFinite(count)) return max;
    return Math.max(max, Math.floor(count));
  }, 0);
}

module.exports = {
  ISSUE_LAYERS,
  ISSUE_SLICES,
  ISSUE_SEVERITIES,
  ISSUE_STATUSES,
  ISSUE_PROVENANCE,
  BACKLOG_STATUSES,
  BACKLOG_PRIORITIES,
  normalizeText,
  normalizeToken,
  normalizeIssueLayer,
  normalizeIssueCategory,
  normalizeIssueSlice,
  normalizeIssueSeverity,
  normalizeIssueStatus,
  normalizeIssueProvenance,
  normalizeBacklogStatus,
  normalizeBacklogPriority,
  normalizeThreadId,
  clampConfidence,
  normalizeSummary,
  normalizeStringList,
  normalizeRootCauseHint,
  normalizeTraceRefs,
  normalizeSupportingEvidence,
  normalizeRelatedMetrics,
  extractSampleCount
};
