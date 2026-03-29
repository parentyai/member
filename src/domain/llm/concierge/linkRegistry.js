'use strict';

const {
  normalizeSourceType,
  normalizeAuthorityBand,
  normalizeFreshnessStatus,
  isUserFacingLink
} = require('./allowedLinkPolicy');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildLinkId(input, index) {
  const payload = input && typeof input === 'object' ? input : {};
  const explicit = normalizeText(payload.link_id || payload.linkId || payload.ref_id || payload.refId || payload.sourceId || payload.sourceRefId);
  if (explicit) return explicit.slice(0, 120);
  const title = normalizeText(payload.title || payload.label || payload.domain || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '_').replace(/^_+|_+$/g, '');
  if (title) return title.slice(0, 120);
  return `link_${index + 1}`;
}

function normalizeJurisdiction(input, fallback) {
  const payload = input && typeof input === 'object' ? input : {};
  const value = normalizeText(payload.jurisdiction || payload.regionKey || fallback);
  return value ? value.slice(0, 120) : null;
}

function normalizeTopic(input, fallback) {
  const payload = input && typeof input === 'object' ? input : {};
  const value = normalizeText(payload.topic || fallback || 'general');
  return value ? value.slice(0, 120) : 'general';
}

function normalizeOpenSurface(input, fallback) {
  const payload = input && typeof input === 'object' ? input : {};
  const value = normalizeText(payload.open_surface || payload.openSurface || fallback || 'text').toLowerCase();
  return value || 'text';
}

function buildLinkRegistryEntry(input, options) {
  const payload = input && typeof input === 'object' ? input : {};
  const opts = options && typeof options === 'object' ? options : {};
  const url = normalizeText(payload.url);
  if (!url) return null;
  if (!isUserFacingLink(payload)) return null;

  const sourceType = normalizeSourceType(payload.source_type || payload.sourceType, payload);
  return {
    link_id: buildLinkId(payload, Number(opts.index) || 0),
    title: normalizeText(payload.title || payload.label || payload.domain || url).slice(0, 200),
    url,
    source_type: sourceType,
    authority_band: normalizeAuthorityBand(Object.assign({}, payload, { source_type: sourceType })),
    jurisdiction: normalizeJurisdiction(payload, opts.jurisdiction),
    topic: normalizeTopic(payload, opts.topic),
    freshness_status: normalizeFreshnessStatus(payload),
    why_relevant: normalizeText(
      payload.why_relevant
      || payload.whyRelevant
      || payload.reason
      || payload.snippet
      || opts.whyRelevant
    ).slice(0, 240),
    open_surface: normalizeOpenSurface(payload, opts.openSurface),
    task_binding: normalizeText(payload.task_binding || payload.taskBinding || opts.taskBinding).slice(0, 120) || null,
    menu_binding: normalizeText(payload.menu_binding || payload.menuBinding || opts.menuBinding).slice(0, 120) || null,
    fallback_if_unavailable: normalizeText(
      payload.fallback_if_unavailable
      || payload.fallbackIfUnavailable
      || opts.fallbackIfUnavailable
    ).slice(0, 240) || null,
    source_snapshot_id: normalizeText(
      payload.source_snapshot_id
      || payload.sourceSnapshotId
      || payload.sourceId
      || payload.sourceRefId
    ).slice(0, 120) || null
  };
}

function buildLinkRegistryEntries(values, options) {
  const rows = Array.isArray(values) ? values : [];
  const opts = options && typeof options === 'object' ? options : {};
  const max = Number.isFinite(Number(opts.limit)) ? Math.max(0, Math.floor(Number(opts.limit))) : 2;
  const seen = new Set();
  const out = [];
  rows.forEach((row, index) => {
    if (out.length >= max) return;
    const normalized = buildLinkRegistryEntry(row, Object.assign({}, opts, { index }));
    if (!normalized) return;
    const key = normalized.url.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(normalized);
  });
  return out;
}

function toEvidenceRefs(entries, options) {
  const rows = Array.isArray(entries) ? entries : [];
  const opts = options && typeof options === 'object' ? options : {};
  const readinessDecision = normalizeText(opts.readinessDecision).toLowerCase() || 'unknown';
  const disclosureRequired = opts.disclosureRequired === true;
  return rows.map((entry) => ({
    ref_id: entry.link_id,
    label: entry.title,
    source_snapshot_id: entry.source_snapshot_id || null,
    authority_tier: (entry.authority_band || 'unknown').toUpperCase(),
    freshness_status: entry.freshness_status || 'unknown',
    readiness_decision: readinessDecision,
    disclosure_required: disclosureRequired,
    url: entry.url
  }));
}

module.exports = {
  buildLinkRegistryEntry,
  buildLinkRegistryEntries,
  toEvidenceRefs
};
