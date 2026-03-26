'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { buildObservationBlockers } = require('../../domain/qualityPatrol/transcript/buildObservationBlockers');
const { normalizeReviewSlice, normalizeText, normalizeToken } = require('../../domain/qualityPatrol/transcript/constants');
const {
  createEmptyTranscriptCoverageDiagnostics
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');

function toIso(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function reviewUnitIdFor(seed) {
  return `review_unit_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 24)}`;
}

function readTraceFile(tracePath) {
  const resolved = path.resolve(process.cwd(), tracePath);
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  return Object.assign({}, payload, { __tracePath: resolved });
}

function normalizeVisibleRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      role: normalizeToken(row && row.role) || 'unknown',
      text: normalizeText(row && row.text)
    }))
    .filter((row) => row.text);
}

function isExecuteMode(trace) {
  const mode = normalizeToken(trace && trace.send_mode);
  return mode === 'execute_once' || mode === 'send_only' || mode === 'open_target';
}

function diffVisibleRows(beforeRows, afterRows) {
  const beforeTexts = new Set(normalizeVisibleRows(beforeRows).map((row) => row.text));
  return normalizeVisibleRows(afterRows).filter((row) => !beforeTexts.has(row.text));
}

function deriveExecuteUserMessage(trace) {
  const sentText = normalizeText(trace && trace.sent_text);
  if (!sentText) return '';
  const afterRows = normalizeVisibleRows(trace && trace.visible_after);
  const beforeRows = normalizeVisibleRows(trace && trace.visible_before);
  const afterHasSent = afterRows.some((row) => row.text === sentText);
  const beforeHasSent = beforeRows.some((row) => row.text === sentText);
  if (afterHasSent && !beforeHasSent) return sentText;
  const sendResult = trace && trace.send_result && typeof trace.send_result === 'object'
    ? trace.send_result.result
    : null;
  if (sendResult && normalizeToken(sendResult.status) === 'sent') return sentText;
  return '';
}

function deriveExecuteAssistantReply(trace) {
  const sentText = normalizeText(trace && trace.sent_text);
  const newRows = diffVisibleRows(trace && trace.visible_before, trace && trace.visible_after);
  const candidate = newRows.find((row) => row.text && row.text !== sentText);
  return candidate ? candidate.text : '';
}

function deriveExecuteBlockerCodes(trace) {
  const blockers = [];
  const targetValidation = trace && trace.target_validation && typeof trace.target_validation === 'object'
    ? trace.target_validation
    : {};
  const sendResult = trace && trace.send_result && typeof trace.send_result === 'object'
    ? trace.send_result.result
    : {};
  const correlationStatus = normalizeToken(trace && trace.correlation_status);

  if (trace && normalizeToken(trace.failure_reason) === 'target_mismatch_stop') {
    blockers.push('target_validation_failed');
  } else if (targetValidation && targetValidation.matched === false) {
    blockers.push('target_validation_failed');
  }

  if (trace && normalizeToken(trace.failure_reason) === 'send_not_confirmed') {
    blockers.push('send_not_confirmed');
  } else if (sendResult && sendResult.status && normalizeToken(sendResult.status) !== 'sent') {
    blockers.push('send_not_confirmed');
  }

  if (correlationStatus === 'post_send_reply_missing') blockers.push('post_send_reply_missing');
  if (correlationStatus === 'post_send_reply_ambiguous') blockers.push('visible_correlation_ambiguous');
  return blockers;
}

function pickLatestMessage(rows, role) {
  const normalizedRole = normalizeToken(role);
  const source = normalizeVisibleRows(rows);
  for (let index = source.length - 1; index >= 0; index -= 1) {
    if (source[index].role === normalizedRole) return source[index].text;
  }
  return '';
}

function deriveSlice(trace) {
  const routing = Array.isArray(trace && trace.scenario_expectations && trace.scenario_expectations.expected_routing)
    ? trace.scenario_expectations.expected_routing.map((value) => normalizeToken(value)).filter(Boolean)
    : [];
  if (routing.includes('follow-up') || routing.includes('followup')) return 'follow-up';
  if (routing.includes('city')) return 'city';
  if (routing.includes('housing')) return 'housing';
  if (routing.includes('broad')) return 'broad';
  return normalizeReviewSlice(trace && trace.slice_hint) || 'other';
}

function derivePriorContextSummary(trace) {
  const rows = normalizeVisibleRows(trace && trace.visible_before).slice(-4);
  if (rows.length <= 0) {
    return {
      text: '',
      available: false
    };
  }
  return {
    text: rows.map((row) => `${row.role}: ${row.text}`).join('\n'),
    available: true
  };
}

function deriveUserMessage(trace) {
  const text = pickLatestMessage(trace && trace.visible_after, 'user')
    || pickLatestMessage(trace && trace.visible_before, 'user')
    || (isExecuteMode(trace) ? deriveExecuteUserMessage(trace) : '')
    || normalizeText(trace && trace.sent_text);
  return {
    text,
    available: Boolean(text)
  };
}

function deriveAssistantReply(trace) {
  const text = pickLatestMessage(trace && trace.visible_after, 'assistant')
    || pickLatestMessage(trace && trace.visible_before, 'assistant')
    || (isExecuteMode(trace) ? deriveExecuteAssistantReply(trace) : '');
  return {
    text,
    available: Boolean(text)
  };
}

function buildEvidenceRefs(trace) {
  const refs = [];
  refs.push({
    source: 'line_desktop_patrol_trace',
    kind: 'desktop_trace',
    refId: normalizeText(trace && trace.run_id) || null,
    traceId: normalizeText(trace && trace.run_id) || null,
    createdAt: toIso(trace && trace.started_at),
    summary: normalizeText(trace && trace.failure_reason) || 'desktop_trace'
  });
  if (normalizeText(trace && trace.screenshot_after)) {
    refs.push({
      source: 'line_desktop_patrol_screenshot',
      kind: 'desktop_screenshot_after',
      refId: normalizeText(trace && trace.screenshot_after),
      traceId: normalizeText(trace && trace.run_id) || null,
      createdAt: toIso(trace && trace.finished_at),
      summary: 'after_screenshot'
    });
  }
  if (normalizeText(trace && trace.ax_tree_after)) {
    refs.push({
      source: 'line_desktop_patrol_ax_tree',
      kind: 'desktop_ax_tree_after',
      refId: normalizeText(trace && trace.ax_tree_after),
      traceId: normalizeText(trace && trace.run_id) || null,
      createdAt: toIso(trace && trace.finished_at),
      summary: 'after_ax_tree'
    });
  }
  return refs;
}

function buildTelemetrySignals(trace, slice, priorContextSummary, assistantReply) {
  const retrievalRefs = Array.isArray(trace && trace.retrieval_refs) ? trace.retrieval_refs : [];
  const expectedRouting = Array.isArray(trace && trace.scenario_expectations && trace.scenario_expectations.expected_routing)
    ? trace.scenario_expectations.expected_routing.map((value) => normalizeToken(value)).filter(Boolean)
    : [];
  const routeKind = expectedRouting[0] || normalizeToken(trace && trace.intent) || normalizeToken(trace && trace.target_id);
  const groundedCandidateAvailable = retrievalRefs.length > 0 ? true : null;

  return {
    routeKind,
    domainIntent: normalizeToken(trace && trace.scenario_id),
    strategy: null,
    strategyReason: normalizeToken(trace && trace.failure_reason) || 'desktop_trace_observation',
    selectedCandidateKind: null,
    fallbackTemplateKind: null,
    finalizerTemplateKind: null,
    genericFallbackSlice: null,
    retrievalBlockedByStrategy: null,
    retrievalPermitReason: null,
    priorContextUsed: null,
    followupResolvedFromHistory: slice === 'follow-up' && priorContextSummary.available === true ? null : null,
    transcriptSnapshotOutcome: assistantReply.available === true ? 'written' : 'skipped_unreviewable_transcript',
    transcriptSnapshotReason: assistantReply.available === true ? 'desktop_trace_observed' : 'assistant_reply_missing',
    transcriptSnapshotLineUserKeyAvailable: trace && trace.target_id ? true : null,
    transcriptSnapshotUserMessageAvailable: null,
    transcriptSnapshotAssistantReplyAvailable: assistantReply.available === true,
    transcriptSnapshotPriorContextSummaryAvailable: priorContextSummary.available === true,
    knowledgeCandidateUsed: null,
    groundedCandidateAvailable,
    cityPackCandidateAvailable: null,
    cityPackUsedInAnswer: null,
    savedFaqCandidateAvailable: null,
    savedFaqUsedInAnswer: null,
    knowledgeGroundingKind: groundedCandidateAvailable === true ? 'desktop_trace_reference' : null,
    readinessDecision: null,
    replyTemplateFingerprint: null,
    repeatRiskScore: null,
    contextCarryScore: null,
    directAnswerApplied: assistantReply.available === true ? true : null,
    repetitionPrevented: null,
    conciseModeApplied: null,
    committedNextActions: [],
    committedFollowupQuestion: ''
  };
}

function buildTranscriptCoverage(reviewUnit) {
  const diagnostics = createEmptyTranscriptCoverageDiagnostics();
  diagnostics.sourceCollections = ['line_desktop_patrol_trace'];
  diagnostics.observedCount = 1;
  diagnostics.snapshotInputDiagnostics.assistantReplyPresent[reviewUnit.assistantReply.available === true ? 'trueCount' : 'falseCount'] = 1;
  diagnostics.snapshotInputDiagnostics.snapshotBuildAttempted.trueCount = 1;

  if (reviewUnit.userMessage.available === true && reviewUnit.assistantReply.available === true) {
    diagnostics.writtenCount = 1;
    diagnostics.transcriptWriteOutcomeCounts.written = 1;
    diagnostics.transcriptCoverageStatus = 'ready';
    return diagnostics;
  }

  diagnostics.skippedCount = 1;
  diagnostics.transcriptWriteOutcomeCounts.skipped_unreviewable_transcript = 1;
  diagnostics.transcriptCoverageStatus = 'blocked';
  diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.assistant_reply_missing = reviewUnit.assistantReply.available === true ? 0 : 1;
  diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason.line_user_key_missing = reviewUnit.lineUserKey ? 0 : 1;
  return diagnostics;
}

async function buildConversationReviewUnitsFromDesktopTrace(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const trace = payload.trace && typeof payload.trace === 'object'
    ? payload.trace
    : readTraceFile(payload.tracePath);

  const sourceWindow = {
    fromAt: toIso(trace && trace.started_at),
    toAt: toIso(trace && trace.finished_at)
  };
  const slice = deriveSlice(trace);
  const userMessage = deriveUserMessage(trace);
  const assistantReply = deriveAssistantReply(trace);
  const priorContextSummary = derivePriorContextSummary(trace);
  const telemetrySignals = buildTelemetrySignals(trace, slice, priorContextSummary, assistantReply);
  const executeBlockerCodes = isExecuteMode(trace) ? deriveExecuteBlockerCodes(trace) : [];
  const hasTraceEvidence = Boolean(
    normalizeText(trace && trace.ax_tree_after)
    || normalizeText(trace && trace.screenshot_after)
    || normalizeVisibleRows(trace && trace.visible_after).length > 0
  );
  const observationBlockers = buildObservationBlockers({
    userMessageAvailable: userMessage.available === true,
    assistantReplyAvailable: assistantReply.available === true,
    priorContextSummaryAvailable: priorContextSummary.available === true,
    needsPriorContextSummary: slice === 'follow-up',
    hasTraceEvidence,
    hasActionLogEvidence: false,
    expectsFaqEvidence: false,
    hasFaqEvidence: false,
    traceHydrationLimited: false,
    extraBlockerCodes: executeBlockerCodes
  });
  const evidenceRefs = buildEvidenceRefs(trace);
  const sourceCollections = Array.from(new Set(evidenceRefs.map((item) => item.source).concat(['line_desktop_patrol_trace'])));
  const reviewUnit = {
    reviewUnitId: reviewUnitIdFor([
      normalizeText(trace && trace.run_id) || 'desktop_trace',
      normalizeText(trace && trace.target_id) || 'unknown_target',
      sourceWindow.fromAt || 'missing_from',
      sourceWindow.toAt || 'missing_to'
    ].join('|')),
    traceId: normalizeText(trace && trace.run_id) || null,
    lineUserKey: normalizeText(trace && trace.target_id) ? `desktop_target:${normalizeText(trace.target_id)}` : null,
    sourceWindow,
    anchorKind: 'desktop_trace',
    slice,
    sliceReason: 'line_desktop_patrol_trace',
    sliceSignalsUsed: Array.isArray(trace && trace.scenario_expectations && trace.scenario_expectations.expected_routing)
      ? trace.scenario_expectations.expected_routing.filter((value) => typeof value === 'string' && value.trim())
      : [],
    userMessage,
    assistantReply,
    priorContextSummary,
    telemetrySignals,
    executeMetadata: isExecuteMode(trace) ? {
      sendMode: normalizeText(trace && trace.send_mode),
      sendStatus: normalizeText(trace && trace.send_result && trace.send_result.result && trace.send_result.result.status),
      targetValidationStatus: trace && trace.target_validation && typeof trace.target_validation === 'object'
        ? (trace.target_validation.matched === true ? 'matched' : (normalizeText(trace.target_validation.reason) || 'failed'))
        : null,
      replyObservationStatus: normalizeText(trace && trace.correlation_status) || null,
    } : null,
    evidenceJoinStatus: {
      actionLog: 'missing_source',
      trace: hasTraceEvidence ? 'joined' : 'missing_source',
      faq: 'not_expected'
    },
    observationBlockers,
    evidenceRefs,
    sourceCollections
  };

  return {
    ok: true,
    sourceWindow,
    reviewUnits: [reviewUnit],
    llmActionLogs: [],
    transcriptCoverage: buildTranscriptCoverage(reviewUnit),
    sourceCollections,
    counts: {
      traces: 1,
      reviewUnits: 1,
      llmActionLogs: 0,
      faqAnswerLogs: 0,
      traceBundles: hasTraceEvidence ? 1 : 0
    },
    joinDiagnostics: {
      faqOnlyRowsSkipped: 0,
      traceHydrationLimitedCount: 0,
      reviewUnitAnchorKindCounts: {
        desktop_trace: 1
      }
    }
  };
}

module.exports = {
  buildConversationReviewUnitsFromDesktopTrace
};
