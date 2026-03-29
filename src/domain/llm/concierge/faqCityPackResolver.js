'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeList(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 3;
  const out = [];
  rows.forEach((row) => {
    if (out.length >= max) return;
    const normalized = normalizeText(row);
    if (!normalized) return;
    out.push(normalized);
  });
  return out;
}

function matchFaqLinks(candidate, officialLinks) {
  const ids = Array.isArray(candidate && candidate.linkRegistryIds) ? candidate.linkRegistryIds : [];
  if (!ids.length) return [];
  const set = new Set(ids.map((item) => normalizeText(item)).filter(Boolean));
  return (Array.isArray(officialLinks) ? officialLinks : []).filter((entry) => set.has(normalizeText(entry.link_id)));
}

function matchCityPackLinks(candidate, officialLinks) {
  const sourceId = normalizeText(candidate && candidate.sourceId);
  if (!sourceId) return [];
  return (Array.isArray(officialLinks) ? officialLinks : []).filter((entry) => {
    const snapshotId = normalizeText(entry && entry.source_snapshot_id);
    return snapshotId === sourceId || snapshotId.startsWith(`${sourceId}:`);
  });
}

function buildFaqContract(candidate, options, officialLinks) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const opts = options && typeof options === 'object' ? options : {};
  const articleId = normalizeText(payload.articleId);
  if (!articleId) return null;
  return {
    faq_or_pack_id: articleId,
    topic: normalizeText(opts.topic || 'general') || 'general',
    jurisdiction: normalizeText(opts.jurisdiction) || null,
    summary: normalizeText(payload.title || payload.body || articleId).slice(0, 240),
    practical_meaning: normalizeText(opts.faqPracticalMeaning || 'FAQの正本候補として参照できます。').slice(0, 240),
    official_links: matchFaqLinks(payload, officialLinks),
    required_docs: normalizeList(opts.requiredDocs, 5),
    due_notes: normalizeList(opts.dueNotes, 3),
    blockers: normalizeList(opts.blockerNotes, 3),
    task_binding: normalizeText(opts.taskBinding) || null,
    menu_binding: normalizeText(opts.menuBinding) || null,
    state_constraints: normalizeList(opts.stateConstraints, 4)
  };
}

function buildCityPackContract(candidate, options, officialLinks) {
  const payload = candidate && typeof candidate === 'object' ? candidate : {};
  const opts = options && typeof options === 'object' ? options : {};
  const sourceId = normalizeText(payload.sourceId);
  if (!sourceId) return null;
  return {
    faq_or_pack_id: sourceId,
    topic: normalizeText(opts.topic || 'general') || 'general',
    jurisdiction: normalizeText(opts.jurisdiction) || null,
    summary: normalizeText(payload.title || sourceId).slice(0, 240),
    practical_meaning: normalizeText(payload.reason || opts.cityPackPracticalMeaning || 'City Packの正本候補として参照できます。').slice(0, 240),
    official_links: matchCityPackLinks(payload, officialLinks),
    required_docs: normalizeList(opts.requiredDocs, 5),
    due_notes: normalizeList(opts.dueNotes, 3),
    blockers: normalizeList(opts.blockerNotes, 3),
    task_binding: normalizeText(opts.taskBinding) || null,
    menu_binding: normalizeText(opts.menuBinding) || null,
    state_constraints: normalizeList(opts.stateConstraints, 4)
  };
}

function buildFaqCityPackContracts(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const officialLinks = Array.isArray(payload.officialLinks) ? payload.officialLinks : [];
  const faqRows = Array.isArray(payload.faqCandidates) ? payload.faqCandidates : [];
  const cityPackRows = Array.isArray(payload.cityPackCandidates) ? payload.cityPackCandidates : [];
  const out = [];

  faqRows.slice(0, 2).forEach((row) => {
    const normalized = buildFaqContract(row, payload, officialLinks);
    if (normalized) out.push(normalized);
  });
  cityPackRows.slice(0, 2).forEach((row) => {
    const normalized = buildCityPackContract(row, payload, officialLinks);
    if (normalized) out.push(normalized);
  });
  return out;
}

module.exports = {
  buildFaqCityPackContracts
};
