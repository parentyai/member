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

function createJoinDiagnostics(target) {
  const diagnostics = target && typeof target === 'object' ? target : {};
  if (!diagnostics.reviewUnitAnchorKindCounts || typeof diagnostics.reviewUnitAnchorKindCounts !== 'object') {
    diagnostics.reviewUnitAnchorKindCounts = {};
  }
  if (!Number.isFinite(Number(diagnostics.faqOnlyRowsSkipped))) diagnostics.faqOnlyRowsSkipped = 0;
  if (!Number.isFinite(Number(diagnostics.traceHydrationLimitedCount))) diagnostics.traceHydrationLimitedCount = 0;
  return diagnostics;
}

function incrementDiagnosticCount(target, key, amount) {
  const numeric = Number(amount);
  const delta = Number.isFinite(numeric) ? numeric : 1;
  target[key] = Number.isFinite(Number(target[key])) ? Number(target[key]) + delta : delta;
}

function resolveAnchorKind(anchor) {
  const hasSnapshot = Boolean(anchor && anchor.snapshot);
  const hasAction = Array.isArray(anchor && anchor.llmActions) && anchor.llmActions.length > 0;
  if (hasSnapshot && hasAction) return 'snapshot_action';
  if (hasSnapshot) return 'snapshot_only';
  if (hasAction) return 'action_only';
  return 'unanchored';
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
    transcriptSnapshotOutcome: pickToken(latestAction && latestAction.transcriptSnapshotOutcome),
    transcriptSnapshotReason: pickToken(latestAction && latestAction.transcriptSnapshotReason),
    transcriptSnapshotLineUserKeyAvailable: pickBoolean(
      hasOwn(latestAction, 'transcriptSnapshotLineUserKeyAvailable')
        ? latestAction.transcriptSnapshotLineUserKeyAvailable === true
        : null
    ),
    transcriptSnapshotUserMessageAvailable: pickBoolean(
      hasOwn(latestAction, 'transcriptSnapshotUserMessageAvailable')
        ? latestAction.transcriptSnapshotUserMessageAvailable === true
        : null
    ),
    transcriptSnapshotAssistantReplyAvailable: pickBoolean(
      hasOwn(latestAction, 'transcriptSnapshotAssistantReplyAvailable')
        ? latestAction.transcriptSnapshotAssistantReplyAvailable === true
        : null
    ),
    transcriptSnapshotPriorContextSummaryAvailable: pickBoolean(
      hasOwn(latestAction, 'transcriptSnapshotPriorContextSummaryAvailable')
        ? latestAction.transcriptSnapshotPriorContextSummaryAvailable === true
        : null
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
    requestShape: pickToken(latestAction && latestAction.requestShape),
    depthIntent: pickToken(latestAction && latestAction.depthIntent),
    transformSource: pickToken(latestAction && latestAction.transformSource),
    outputForm: pickToken(latestAction && latestAction.outputForm),
    knowledgeScope: pickToken(latestAction && latestAction.knowledgeScope),
    locationHintKind: pickToken(latestAction && latestAction.locationHintKind),
    locationHintCityKey: pickToken(latestAction && latestAction.locationHintCityKey),
    requestedCityKey: pickToken(latestAction && latestAction.requestedCityKey),
    matchedCityKey: pickToken(latestAction && latestAction.matchedCityKey),
    citySpecificitySatisfied: pickBoolean(
      hasOwn(latestAction, 'citySpecificitySatisfied') ? latestAction.citySpecificitySatisfied === true : null
    ),
    citySpecificityReason: pickToken(latestAction && latestAction.citySpecificityReason),
    violationCodes: pickStringList(latestAction && latestAction.violationCodes),
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

function buildConversationReviewAnchors(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const snapshots = Array.isArray(payload.snapshots) ? payload.snapshots : [];
  const llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : [];
  const faqAnswerLogs = Array.isArray(payload.faqAnswerLogs) ? payload.faqAnswerLogs : [];
  const diagnostics = createJoinDiagnostics(payload.joinDiagnosticsTarget);
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

  faqAnswerLogs.forEach((row) => {
    const traceId = normalizeText(row && row.traceId);
    if (!traceId) {
      incrementDiagnosticCount(diagnostics, 'faqOnlyRowsSkipped', 1);
      return;
    }
    const anchor = anchors.get(`trace:${traceId}`);
    if (!anchor) {
      incrementDiagnosticCount(diagnostics, 'faqOnlyRowsSkipped', 1);
      return;
    }
    anchor.traceId = traceId || anchor.traceId;
    anchor.faqAnswerLogs.push(Object.assign({ id: row && row.id ? row.id : null }, row));
  });

  diagnostics.reviewUnitAnchorKindCounts = Array.from(anchors.values()).reduce((acc, anchor) => {
    const kind = resolveAnchorKind(anchor);
    if (kind === 'unanchored') return acc;
    acc[kind] = Number.isFinite(Number(acc[kind])) ? Number(acc[kind]) + 1 : 1;
    return acc;
  }, {});

  const anchorTraceIds = Array.from(new Set(Array.from(anchors.values())
    .map((anchor) => normalizeText(anchor && anchor.traceId))
    .filter(Boolean)));

  return {
    anchors,
    diagnostics,
    anchorTraceIds
  };
}

function buildReviewUnit(anchor, traceBundle, options) {
  const payload = options && typeof options === 'object' ? options : {};
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
  const traceId = pickString(anchor.traceId, snapshot && snapshot.traceId, latestAction && latestAction.traceId, faqAnswerLogs[0] && faqAnswerLogs[0].traceId);
  const traceHydrationLimited = payload.traceHydrationLimited === true;
  const hasTraceEvidence = Boolean(traceBundle && traceBundle.ok === true && traceSummary && traceSummary.completeness > 0);
  const blockers = buildObservationBlockers({
    userMessageAvailable: snapshot ? snapshot.userMessageAvailable === true : false,
    assistantReplyAvailable: snapshot ? snapshot.assistantReplyAvailable === true : false,
    priorContextSummaryAvailable: snapshot ? snapshot.priorContextSummaryAvailable === true : false,
    needsPriorContextSummary: telemetrySignals.priorContextUsed === true || telemetrySignals.followupResolvedFromHistory === true,
    hasTraceEvidence,
    hasActionLogEvidence: llmActions.length > 0,
    expectsFaqEvidence: telemetrySignals.savedFaqUsedInAnswer === true
      || telemetrySignals.savedFaqCandidateAvailable === true
      || telemetrySignals.selectedCandidateKind === 'saved_faq_candidate',
    hasFaqEvidence: faqAnswerLogs.length > 0,
    traceHydrationLimited
  });
  const lineUserKey = pickString(
    snapshot && snapshot.lineUserKey,
    buildLineUserKey(latestAction && latestAction.lineUserId)
  );
  const sourceWindow = computeSourceWindow(anchor);
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
    anchorKind: resolveAnchorKind(anchor),
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
    evidenceJoinStatus: {
      actionLog: llmActions.length > 0 ? 'joined' : 'missing_source',
      trace: hasTraceEvidence
        ? 'joined'
        : (traceHydrationLimited ? 'limited_by_trace_hydration' : 'missing_source'),
      faq: faqAnswerLogs.length > 0
        ? 'joined'
        : (telemetrySignals.savedFaqUsedInAnswer === true
          || telemetrySignals.savedFaqCandidateAvailable === true
          || telemetrySignals.selectedCandidateKind === 'saved_faq_candidate'
          ? 'missing_source'
          : 'not_expected')
    },
    observationBlockers: blockers,
    evidenceRefs: evidence.evidenceRefs,
    sourceCollections: evidence.sourceCollections
  };
}

function buildConversationReviewUnits(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const traceBundles = payload.traceBundles && typeof payload.traceBundles === 'object' ? payload.traceBundles : {};
  const traceHydrationLimitedTraceIds = payload.traceHydrationLimitedTraceIds instanceof Set
    ? payload.traceHydrationLimitedTraceIds
    : new Set(Array.isArray(payload.traceHydrationLimitedTraceIds) ? payload.traceHydrationLimitedTraceIds : []);
  const anchors = payload.anchors instanceof Map
    ? payload.anchors
    : buildConversationReviewAnchors(payload).anchors;

  return Array.from(anchors.values())
    .map((anchor) => {
      const traceId = normalizeText(anchor && anchor.traceId);
      return buildReviewUnit(
        anchor,
        traceId ? traceBundles[traceId] || null : null,
        {
          traceHydrationLimited: Boolean(traceId && traceHydrationLimitedTraceIds.has(traceId))
        }
      );
    })
    .sort((left, right) => {
      const leftAt = left && left.sourceWindow ? left.sourceWindow.toAt : null;
      const rightAt = right && right.sourceWindow ? right.sourceWindow.toAt : null;
      return (rightAt ? new Date(rightAt).getTime() : 0) - (leftAt ? new Date(leftAt).getTime() : 0);
    });
}

module.exports = {
  buildConversationReviewAnchors,
  buildConversationReviewUnits
};
