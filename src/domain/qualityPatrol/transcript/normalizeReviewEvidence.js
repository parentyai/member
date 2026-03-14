'use strict';

const { normalizeText } = require('./constants');

function toIso(value) {
  if (!value) return null;
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.toISOString();
  }
  return null;
}

function buildKey(ref) {
  return [
    normalizeText(ref && ref.source),
    normalizeText(ref && ref.kind),
    normalizeText(ref && ref.refId),
    normalizeText(ref && ref.traceId),
    normalizeText(ref && ref.createdAt)
  ].join('|');
}

function appendRef(target, ref) {
  const source = normalizeText(ref && ref.source);
  if (!source) return;
  const row = {
    source,
    kind: normalizeText(ref && ref.kind) || 'evidence',
    refId: normalizeText(ref && ref.refId) || null,
    traceId: normalizeText(ref && ref.traceId) || null,
    createdAt: toIso(ref && ref.createdAt),
    summary: normalizeText(ref && ref.summary) || null
  };
  const key = buildKey(row);
  if (target.seen.has(key)) return;
  target.seen.add(key);
  target.rows.push(row);
}

function normalizeReviewEvidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const acc = { rows: [], seen: new Set() };
  const snapshot = payload.snapshot && typeof payload.snapshot === 'object' ? payload.snapshot : null;
  const llmActions = Array.isArray(payload.llmActions) ? payload.llmActions : [];
  const faqAnswerLogs = Array.isArray(payload.faqAnswerLogs) ? payload.faqAnswerLogs : [];
  const traceBundle = payload.traceBundle && typeof payload.traceBundle === 'object' ? payload.traceBundle : null;

  if (snapshot) {
    appendRef(acc, {
      source: 'conversation_review_snapshots',
      kind: 'masked_transcript_snapshot',
      refId: snapshot.id,
      traceId: snapshot.traceId,
      createdAt: snapshot.createdAt,
      summary: [
        snapshot.userMessageAvailable === true ? 'user' : null,
        snapshot.assistantReplyAvailable === true ? 'assistant' : null,
        snapshot.priorContextSummaryAvailable === true ? 'context' : null
      ].filter(Boolean).join('/')
    });
  }

  llmActions.slice(0, 2).forEach((row) => {
    appendRef(acc, {
      source: 'llm_action_logs',
      kind: 'action_log',
      refId: row && row.id,
      traceId: row && row.traceId,
      createdAt: row && row.createdAt,
      summary: [
        normalizeText(row && row.routeKind),
        normalizeText(row && row.strategyReason),
        normalizeText(row && row.selectedCandidateKind)
      ].filter(Boolean).join(' / ')
    });
  });

  faqAnswerLogs.slice(0, 2).forEach((row) => {
    const matchedCount = Array.isArray(row && row.matchedArticleIds) ? row.matchedArticleIds.length : 0;
    appendRef(acc, {
      source: 'faq_answer_logs',
      kind: 'faq_evidence',
      refId: row && row.id,
      traceId: row && row.traceId,
      createdAt: row && row.createdAt,
      summary: matchedCount > 0
        ? `matchedArticleIds:${matchedCount}`
        : (normalizeText(row && row.blockedReason) ? `blocked:${normalizeText(row && row.blockedReason)}` : 'faq_signal')
    });
  });

  if (traceBundle && normalizeText(traceBundle.traceId)) {
    const summary = traceBundle.traceJoinSummary && typeof traceBundle.traceJoinSummary === 'object'
      ? traceBundle.traceJoinSummary
      : {};
    appendRef(acc, {
      source: 'trace_bundle',
      kind: 'trace_join_summary',
      refId: normalizeText(traceBundle.traceId),
      traceId: normalizeText(traceBundle.traceId),
      createdAt: null,
      summary: `completeness:${Number.isFinite(Number(summary.completeness)) ? Number(summary.completeness) : 0}`
    });
  }

  const evidenceRefs = acc.rows.slice(0, 6);
  const sourceCollections = Array.from(new Set(evidenceRefs.map((row) => row.source).filter(Boolean)));
  return {
    evidenceRefs,
    sourceCollections
  };
}

module.exports = {
  normalizeReviewEvidence
};
