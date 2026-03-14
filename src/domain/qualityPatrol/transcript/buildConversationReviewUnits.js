'use strict';

const crypto = require('node:crypto');
const { buildLineUserKey } = require('../transcriptMasking/buildMaskedConversationReviewSnapshot');
const { classifyConversationSlice } = require('./classifyConversationSlice');
const { buildObservationBlockers } = require('./buildObservationBlockers');
const { normalizeReviewEvidence } = require('./normalizeReviewEvidence');
const { normalizeText, normalizeToken, normalizeReviewSlice } = require('./constants');

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

function hasOwn(object, key) {
  return Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);
}

function pickString() {
  for (const value of arguments) {
    const normalized = normalizeText(value);
    if (normalized) return normalized;
  }
  return null;
}

function pickToken() {
  for (const value of arguments) {
    const normalized = normalizeToken(value);
    if (normalized) return normalized;
  }
  return null;
}

function pickBoolean() {
  for (const candidate of arguments) {
    if (candidate === null || candidate === undefined) continue;
    if (typeof candidate === 'boolean') return candidate;
  }
  return null;
}

function pickNumber() {
  for (const candidate of arguments) {
    const numeric = Number(candidate);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function pickStringList() {
  for (const candidate of arguments) {
    if (!Array.isArray(candidate)) continue;
    const normalized = candidate.map((value) => normalizeText(value)).filter(Boolean);
    if (normalized.length > 0) return normalized;
  }
  return [];
}

function reviewUnitIdFor(seed) {
  return `review_unit_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 24)}`;
}

function compareCreatedDesc(left, right) {
  const leftAt = toIso(left && left.createdAt);
  const rightAt = toIso(right && right.createdAt);
  return (rightAt ? new Date(rightAt).getTime() : 0) - (leftAt ? new Date(leftAt).getTime() : 0);
}

function buildAnchorKey(kind, row, index) {
  const traceId = normalizeText(row && row.traceId);
  if (traceId) return `trace:${traceId}`;
  const rowId = normalizeText(row && row.id);
  if (rowId) return `${kind}:${rowId}`;
  const createdAt = toIso(row && row.createdAt) || `idx:${index}`;
  if (kind === 'snapshot') {
    return `${kind}:${normalizeText(row && row.lineUserKey) || 'missing'}:${createdAt}`;
  }
  if (kind === 'action') {
    return `${kind}:${buildLineUserKey(row && row.lineUserId) || 'missing'}:${createdAt}`;
  }
  return `${kind}:${createdAt}`;
}

function ensureAnchor(map, key) {
  if (!map.has(key)) {
    map.set(key, {
      key,
      traceId: null,
      snapshot: null,
      llmActions: [],
      faqAnswerLogs: []
    });
  }
  return map.get(key);
}

function computeSourceWindow(anchor) {
  const allRows = [];
  if (anchor.snapshot) allRows.push(anchor.snapshot);
  allRows.push(...anchor.llmActions);
  allRows.push(...anchor.faqAnswerLogs);
  const times = allRows
    .map((row) => toIso(row && row.createdAt))
    .filter(Boolean)
    .sort();
  return {
    fromAt: times.length ? times[0] : null,
    toAt: times.length ? times[times.length - 1] : null
  };
}

function buildTelemetrySignals(snapshot, latestAction) {
  return {
    routeKind: pickToken(latestAction && latestAction.routeKind, snapshot && snapshot.routeKind),
    domainIntent: pickToken(latestAction && latestAction.domainIntent, snapshot && snapshot.domainIntent),
    strategy: pickToken(latestAction && latestAction.strategy, snapshot && snapshot.strategy),
    strategyReason: pickToken(latestAction && latestAction.strategyReason),
    selectedCandidateKind: pickToken(latestAction && latestAction.selectedCandidateKind, snapshot && snapshot.selectedCandidateKind),
    fallbackTemplateKind: pickToken(latestAction && latestAction.fallbackTemplateKind, snapshot && snapshot.fallbackTemplateKind),
    finalizerTemplateKind: pickToken(latestAction && latestAction.finalizerTemplateKind),
    genericFallbackSlice: normalizeReviewSlice(pickToken(latestAction && latestAction.genericFallbackSlice, snapshot && snapshot.genericFallbackSlice)),
    retrievalBlockedByStrategy: pickBoolean(
      hasOwn(latestAction, 'retrievalBlockedByStrategy') ? latestAction.retrievalBlockedByStrategy === true : null
    ),
    retrievalPermitReason: pickToken(latestAction && latestAction.retrievalPermitReason),
    priorContextUsed: pickBoolean(
      hasOwn(latestAction, 'priorContextUsed') ? latestAction.priorContextUsed === true : null,
      snapshot ? snapshot.priorContextUsed === true : null
    ),
    followupResolvedFromHistory: pickBoolean(
      hasOwn(latestAction, 'followupResolvedFromHistory') ? latestAction.followupResolvedFromHistory === true : null,
      snapshot ? snapshot.followupResolvedFromHistory === true : null
    ),
    knowledgeCandidateUsed: pickBoolean(
      hasOwn(latestAction, 'knowledgeCandidateUsed') ? latestAction.knowledgeCandidateUsed === true : null,
      snapshot ? snapshot.knowledgeCandidateUsed === true : null
    ),
    groundedCandidateAvailable: pickBoolean(
      hasOwn(latestAction, 'groundedCandidateAvailable') ? latestAction.groundedCandidateAvailable === true : null
    ),
    cityPackCandidateAvailable: pickBoolean(
      hasOwn(latestAction, 'cityPackCandidateAvailable') ? latestAction.cityPackCandidateAvailable === true : null
    ),
    cityPackUsedInAnswer: pickBoolean(
      hasOwn(latestAction, 'cityPackUsedInAnswer') ? latestAction.cityPackUsedInAnswer === true : null
    ),
    savedFaqCandidateAvailable: pickBoolean(
      hasOwn(latestAction, 'savedFaqCandidateAvailable') ? latestAction.savedFaqCandidateAvailable === true : null
    ),
    savedFaqUsedInAnswer: pickBoolean(
      hasOwn(latestAction, 'savedFaqUsedInAnswer') ? latestAction.savedFaqUsedInAnswer === true : null
    ),
    knowledgeGroundingKind: pickToken(latestAction && latestAction.knowledgeGroundingKind),
    readinessDecision: pickToken(latestAction && latestAction.readinessDecision, snapshot && snapshot.readinessDecision),
    replyTemplateFingerprint: pickString(latestAction && latestAction.replyTemplateFingerprint, snapshot && snapshot.replyTemplateFingerprint),
    repeatRiskScore: pickNumber(latestAction && latestAction.repeatRiskScore),
    contextCarryScore: pickNumber(latestAction && latestAction.contextCarryScore),
    directAnswerApplied: pickBoolean(
      hasOwn(latestAction, 'directAnswerApplied') ? latestAction.directAnswerApplied === true : null
    ),
    repetitionPrevented: pickBoolean(
      hasOwn(latestAction, 'repetitionPrevented') ? latestAction.repetitionPrevented === true : null
    ),
    conciseModeApplied: pickBoolean(
      hasOwn(latestAction, 'conciseModeApplied') ? latestAction.conciseModeApplied === true : null
    ),
    committedNextActions: pickStringList(latestAction && latestAction.committedNextActions),
    committedFollowupQuestion: pickString(latestAction && latestAction.committedFollowupQuestion)
  };
}

function buildReviewUnit(anchor, traceBundle) {
  const snapshot = anchor.snapshot;
  const llmActions = anchor.llmActions.slice().sort(compareCreatedDesc);
  const faqAnswerLogs = anchor.faqAnswerLogs.slice().sort(compareCreatedDesc);
  const latestAction = llmActions[0] || null;
  const telemetrySignals = buildTelemetrySignals(snapshot, latestAction);
  const sliceClassification = classifyConversationSlice(telemetrySignals);
  const evidence = normalizeReviewEvidence({
    snapshot,
    llmActions,
    faqAnswerLogs,
    traceBundle
  });
  const traceSummary = traceBundle && traceBundle.traceJoinSummary && typeof traceBundle.traceJoinSummary === 'object'
    ? traceBundle.traceJoinSummary
    : null;
  const blockers = buildObservationBlockers({
    userMessageAvailable: snapshot ? snapshot.userMessageAvailable === true : false,
    assistantReplyAvailable: snapshot ? snapshot.assistantReplyAvailable === true : false,
    priorContextSummaryAvailable: snapshot ? snapshot.priorContextSummaryAvailable === true : false,
    needsPriorContextSummary: telemetrySignals.priorContextUsed === true || telemetrySignals.followupResolvedFromHistory === true,
    hasTraceEvidence: Boolean(traceBundle && traceBundle.ok === true && traceSummary && traceSummary.completeness > 0),
    hasActionLogEvidence: llmActions.length > 0,
    expectsFaqEvidence: telemetrySignals.savedFaqUsedInAnswer === true
      || telemetrySignals.savedFaqCandidateAvailable === true
      || telemetrySignals.selectedCandidateKind === 'saved_faq_candidate',
    hasFaqEvidence: faqAnswerLogs.length > 0
  });
  const lineUserKey = pickString(
    snapshot && snapshot.lineUserKey,
    buildLineUserKey(latestAction && latestAction.lineUserId)
  );
  const sourceWindow = computeSourceWindow(anchor);
  const traceId = pickString(anchor.traceId, snapshot && snapshot.traceId, latestAction && latestAction.traceId, faqAnswerLogs[0] && faqAnswerLogs[0].traceId);
  const reviewUnitId = reviewUnitIdFor([
    traceId || anchor.key,
    lineUserKey || 'missing_line_user_key',
    sourceWindow.fromAt || 'missing_from',
    sourceWindow.toAt || 'missing_to'
  ].join('|'));

  return {
    reviewUnitId,
    traceId: traceId || null,
    lineUserKey: lineUserKey || null,
    sourceWindow,
    slice: sliceClassification.slice,
    sliceReason: sliceClassification.sliceReason,
    sliceSignalsUsed: sliceClassification.sliceSignalsUsed,
    userMessage: {
      text: snapshot && snapshot.userMessageMasked ? snapshot.userMessageMasked : '',
      available: snapshot ? snapshot.userMessageAvailable === true : false
    },
    assistantReply: {
      text: snapshot && snapshot.assistantReplyMasked ? snapshot.assistantReplyMasked : '',
      available: snapshot ? snapshot.assistantReplyAvailable === true : false
    },
    priorContextSummary: {
      text: snapshot && snapshot.priorContextSummaryMasked ? snapshot.priorContextSummaryMasked : '',
      available: snapshot ? snapshot.priorContextSummaryAvailable === true : false
    },
    telemetrySignals,
    observationBlockers: blockers,
    evidenceRefs: evidence.evidenceRefs,
    sourceCollections: evidence.sourceCollections
  };
}

function buildConversationReviewUnits(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : [];
  const faqAnswerLogs = Array.isArray(payload.faqAnswerLogs) ? payload.faqAnswerLogs : [];
  const traceBundles = payload.traceBundles && typeof payload.traceBundles === 'object' ? payload.traceBundles : {};

  const anchors = new Map();

  snapshots.forEach((row, index) => {
    const key = buildAnchorKey('snapshot', row, index);
    const anchor = ensureAnchor(anchors, key);
    anchor.traceId = normalizeText(row && row.traceId) || anchor.traceId;
    const candidate = Object.assign({ id: row && row.id ? row.id : null }, row);
    if (!anchor.snapshot || compareCreatedDesc(anchor.snapshot, candidate) > 0) {
      anchor.snapshot = candidate;
    }
  });

  llmActionLogs.forEach((row, index) => {
    const key = buildAnchorKey('action', row, index);
    const anchor = ensureAnchor(anchors, key);
    anchor.traceId = normalizeText(row && row.traceId) || anchor.traceId;
    anchor.llmActions.push(Object.assign({ id: row && row.id ? row.id : null }, row));
  });

  faqAnswerLogs.forEach((row, index) => {
    const key = buildAnchorKey('faq', row, index);
    const anchor = ensureAnchor(anchors, key);
    anchor.traceId = normalizeText(row && row.traceId) || anchor.traceId;
    anchor.faqAnswerLogs.push(Object.assign({ id: row && row.id ? row.id : null }, row));
  });

  return Array.from(anchors.values())
    .map((anchor) => buildReviewUnit(anchor, anchor.traceId ? traceBundles[anchor.traceId] || null : null))
    .sort((left, right) => {
      const leftAt = left && left.sourceWindow ? left.sourceWindow.toAt : null;
      const rightAt = right && right.sourceWindow ? right.sourceWindow.toAt : null;
      return (rightAt ? new Date(rightAt).getTime() : 0) - (leftAt ? new Date(leftAt).getTime() : 0);
    });
}

module.exports = {
  buildConversationReviewUnits
};
