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

function readJsonIfExists(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}

function normalizeSendMode(value) {
  const normalized = normalizeToken(value);
  if (normalized === 'execute') return 'execute_once';
  return normalized;
}

function normalizeVisibleRowsFromTranscript(transcript) {
  const text = normalizeText(transcript);
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean)
    .map((line) => ({ role: 'visible_text', text: line }));
}

function normalizeDesktopResultPayload(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const nested = payload.result && typeof payload.result === 'object' ? payload.result : {};
  const evaluatorScores = nested.evaluatorScores && typeof nested.evaluatorScores === 'object'
    ? nested.evaluatorScores
    : {};
  const visibleBefore = Array.isArray(nested.visibleBefore) && nested.visibleBefore.length > 0
    ? nested.visibleBefore
    : normalizeVisibleRowsFromTranscript(nested.transcriptBefore);
  const visibleAfter = Array.isArray(nested.visibleAfter) && nested.visibleAfter.length > 0
    ? nested.visibleAfter
    : normalizeVisibleRowsFromTranscript(nested.transcriptAfterReply || nested.transcriptAfterSend);
  return {
    raw: payload,
    nested,
    mode: normalizeSendMode(nested.mode || payload.mode),
    targetMatchedHeuristic: nested.targetMatchedHeuristic === true || payload.targetMatchedHeuristic === true,
    targetMismatchObserved: nested.targetMatchedHeuristic === false || payload.targetMatchedHeuristic === false,
    replyObserved: nested.replyObserved === true || payload.replyObserved === true || evaluatorScores.replyObserved === true,
    sentVisible: evaluatorScores.sentVisible === true || evaluatorScores.transcriptChanged === true,
    visibleBefore,
    visibleAfter,
    transcriptBefore: normalizeText(nested.transcriptBefore),
    transcriptAfterSend: normalizeText(nested.transcriptAfterSend),
    transcriptAfterReply: normalizeText(nested.transcriptAfterReply),
    evaluatorScores
  };
}

function hydrateTraceWithResult(trace, resultPayload, tracePath, resultPath) {
  const normalizedResult = normalizeDesktopResultPayload(resultPayload);
  if (!normalizedResult) {
    return Object.assign({}, trace, { __tracePath: tracePath, __resultPath: null, __resultPayload: null });
  }
  const sendMode = normalizeSendMode(trace && trace.send_mode) || normalizedResult.mode || null;
  const sendResult = trace && trace.send_result && typeof trace.send_result === 'object'
    ? trace.send_result
    : ((sendMode === 'execute_once' || sendMode === 'send_only') && normalizedResult.sentVisible === true
      ? { result: { status: 'sent' } }
      : null);
  const targetValidation = trace && trace.target_validation && typeof trace.target_validation === 'object'
    ? trace.target_validation
    : (normalizedResult.targetMatchedHeuristic === true || normalizedResult.targetMismatchObserved === true
      ? {
        matched: normalizedResult.targetMatchedHeuristic === true,
        reason: normalizedResult.targetMatchedHeuristic === true ? 'desktop_result_bridge' : 'desktop_result_unmatched'
      }
      : null);
  const correlationStatus = normalizeToken(trace && trace.correlation_status)
    || ((sendMode === 'execute_once' || sendMode === 'send_only')
      ? (normalizedResult.replyObserved === true ? 'reply_observed' : (sendResult ? 'post_send_reply_missing' : null))
      : null);
  const visibleBefore = normalizeVisibleRows(trace && trace.visible_before).length > 0
    ? trace.visible_before
    : normalizedResult.visibleBefore;
  const visibleAfter = normalizeVisibleRows(trace && trace.visible_after).length > 0
    ? trace.visible_after
    : normalizedResult.visibleAfter;

  return Object.assign({}, trace, {
    send_mode: sendMode,
    send_result: sendResult,
    target_validation: targetValidation,
    correlation_status: correlationStatus,
    visible_before: visibleBefore,
    visible_after: visibleAfter,
    __tracePath: tracePath,
    __resultPath: resultPath,
    __resultPayload: normalizedResult
  });
}

function readTraceFile(tracePath) {
  const resolved = path.resolve(process.cwd(), tracePath);
  const payload = JSON.parse(fs.readFileSync(resolved, 'utf8'));
  const resultPath = path.join(path.dirname(resolved), 'result.json');
  const resultPayload = readJsonIfExists(resultPath);
  return hydrateTraceWithResult(payload, resultPayload, resolved, resultPath);
}

function normalizeVisibleRows(rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      role: normalizeToken(row && row.role) || 'unknown',
      text: normalizeText(row && row.text)
    }))
    .filter((row) => row.text);
}

function inferMessageRole(explicitRole, speakerLabel) {
  const normalizedRole = normalizeToken(explicitRole);
  if (normalizedRole === 'assistant' || normalizedRole === 'user') return normalizedRole;
  const label = normalizeText(speakerLabel);
  if (!label) return 'unknown';
  if (label.includes('メンバー')) return 'assistant';
  return 'user';
}

function buildVisibleMessages(rows) {
  const source = normalizeVisibleRows(rows);
  const messages = [];
  let current = null;
  source.forEach((row) => {
    const text = normalizeText(row && row.text);
    if (!text) return;
    if (/^\d{4}\.\d{2}\.\d{2}\b/u.test(text)) {
      current = null;
      return;
    }
    const timestamped = text.match(/^(\d{1,2}:\d{2})\s+(\S+)\s+(.+)$/u);
    if (timestamped) {
      current = {
        role: inferMessageRole(row && row.role, timestamped[2]),
        speaker: normalizeText(timestamped[2]),
        text: normalizeText(timestamped[3])
      };
      if (current.text) messages.push(current);
      return;
    }
    if (row && (normalizeToken(row.role) === 'assistant' || normalizeToken(row.role) === 'user')) {
      current = {
        role: inferMessageRole(row.role, null),
        speaker: null,
        text
      };
      messages.push(current);
      return;
    }
    if (current) {
      current.text = normalizeText(`${current.text}\n${text}`);
      return;
    }
    current = {
      role: inferMessageRole(row && row.role, null),
      speaker: null,
      text
    };
    messages.push(current);
  });
  return messages.filter((row) => normalizeText(row && row.text));
}

function isExecuteMode(trace) {
  const mode = normalizeSendMode(trace && trace.send_mode) || normalizeSendMode(trace && trace.__resultPayload && trace.__resultPayload.mode);
  return mode === 'execute_once' || mode === 'send_only' || mode === 'open_target';
}

function diffVisibleRows(beforeRows, afterRows) {
  const beforeTexts = new Set(normalizeVisibleRows(beforeRows).map((row) => row.text));
  return normalizeVisibleRows(afterRows).filter((row) => !beforeTexts.has(row.text));
}

function matchesSentText(candidate, sentText) {
  const normalizedCandidate = normalizeText(candidate).replace(/\s+/gu, ' ');
  const normalizedSentText = normalizeText(sentText).replace(/\s+/gu, ' ');
  if (!normalizedCandidate || !normalizedSentText) return false;
  return normalizedCandidate === normalizedSentText || normalizedCandidate.endsWith(normalizedSentText);
}

function deriveExecuteUserMessage(trace) {
  const sentText = normalizeText(trace && trace.sent_text);
  if (!sentText) return '';
  const afterMessages = buildVisibleMessages(trace && trace.visible_after);
  for (let index = afterMessages.length - 1; index >= 0; index -= 1) {
    const message = afterMessages[index];
    if (message.role === 'user' && matchesSentText(message.text, sentText)) return message.text;
  }
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
  const afterMessages = buildVisibleMessages(trace && trace.visible_after);
  for (let index = afterMessages.length - 1; index >= 0; index -= 1) {
    const message = afterMessages[index];
    if (message.role !== 'user' || !matchesSentText(message.text, sentText)) continue;
    for (let replyIndex = index + 1; replyIndex < afterMessages.length; replyIndex += 1) {
      if (afterMessages[replyIndex].role === 'assistant') return afterMessages[replyIndex].text;
    }
    break;
  }
  for (let index = afterMessages.length - 1; index >= 0; index -= 1) {
    if (afterMessages[index].role === 'assistant') return afterMessages[index].text;
  }
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
  const source = buildVisibleMessages(rows);
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

function inferConversationIntent() {
  const text = normalizeText([].concat(...Array.from(arguments)).filter(Boolean).join('\n'));
  if (!text) return null;
  if (/(学校|学区|途中編入|編入|転校|入学|district|school|enrollment|registration|immunization|vaccin)/i.test(text)) {
    return 'school';
  }
  if (/(住まい|物件|家賃|housing|rent|lease|内見|引っ越し)/i.test(text)) {
    return 'housing';
  }
  if (/(ssn|social security|ソーシャルセキュリティ)/i.test(text)) {
    return 'ssn';
  }
  if (/(銀行|bank|口座|debit|checking|savings)/i.test(text)) {
    return 'banking';
  }
  if (/(住民票|市区町村|市役所|区役所|education office|教育窓口|コンビニ交付|municipal)/i.test(text)) {
    return 'city';
  }
  return null;
}

function cleanDerivedText(value) {
  return normalizeText(value)
    .replace(/^[・\-]\s*/u, '')
    .replace(/[。.!！]+$/u, '')
    .replace(/(?:こと|予定)です$/u, '')
    .replace(/です$/u, '')
    .replace(/のが確実です$/u, '')
    .replace(/と進めやすいです$/u, '')
    .trim();
}

function uniqueNormalized(values) {
  const output = [];
  const seen = new Set();
  (Array.isArray(values) ? values : []).forEach((value) => {
    const cleaned = cleanDerivedText(value);
    if (!cleaned) return;
    const token = normalizeToken(cleaned);
    if (!token || seen.has(token)) return;
    seen.add(token);
    output.push(cleaned);
  });
  return output;
}

function deriveOfficialCheckTargets(replyText) {
  const normalizedReply = normalizeText(replyText);
  if (!normalizedReply) return [];
  const targets = [];
  normalizedReply.split(/\n+/u).forEach((line) => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) return;
    const explicitTarget = normalizedLine.replace(/^確認先は[、:：]?\s*/u, '');
    if (explicitTarget !== normalizedLine) {
      targets.push(explicitTarget);
      return;
    }
    if (
      (
        /窓口/u.test(normalizedLine)
        || (
          /(page|office|requirements|registration|enrollment|appointment)/i.test(normalizedLine)
          && !/まず/u.test(normalizedLine)
        )
      )
      && !/^いまやる一手/u.test(normalizedLine)
    ) {
      targets.push(normalizedLine);
    }
  });
  return uniqueNormalized(targets);
}

function deriveCommittedNextActions(replyText) {
  const normalizedReply = normalizeText(replyText);
  if (!normalizedReply) return [];
  const explicitActions = [];
  const inferredActions = [];
  normalizedReply.split(/\n+/u).forEach((line) => {
    const normalizedLine = normalizeText(line);
    if (!normalizedLine) return;
    if (/^確認先は/u.test(normalizedLine)) return;
    let candidate = '';
    if (/^いまやる一手/u.test(normalizedLine)) {
      candidate = normalizedLine.replace(/^いまやる一手は?[、:：]?\s*/u, '');
      explicitActions.push(candidate);
      return;
    } else if (/^今日やる一手/u.test(normalizedLine)) {
      candidate = normalizedLine.replace(/^今日やる一手は?[、:：]?\s*/u, '');
      explicitActions.push(candidate);
      return;
    } else if (normalizedLine.includes('まず')) {
      candidate = normalizedLine.slice(normalizedLine.indexOf('まず'));
    } else if (/^次に/u.test(normalizedLine) || /^次は/u.test(normalizedLine)) {
      candidate = normalizedLine.replace(/^次[には]?[、:：]?\s*/u, '');
    }
    if (!candidate && /(確認|申請|予約|連絡|開いて|メモ|提出)/u.test(normalizedLine)) {
      candidate = normalizedLine;
    }
    inferredActions.push(
      normalizeText(candidate)
        .replace(/^まず[、\s]*/u, '')
        .replace(/^次[には]?[、\s]*/u, '')
    );
  });
  const preferred = explicitActions.length > 0 ? explicitActions : inferredActions;
  return uniqueNormalized(preferred).slice(0, 3);
}

function derivePriorContextSummary(trace) {
  const rows = buildVisibleMessages(trace && trace.visible_before).slice(-4);
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
  if (normalizeText(trace && trace.__resultPath)) {
    refs.push({
      source: 'line_desktop_patrol_result',
      kind: 'desktop_result',
      refId: normalizeText(trace && trace.__resultPath),
      traceId: normalizeText(trace && trace.run_id) || null,
      createdAt: toIso(trace && trace.finished_at),
      summary: normalizeText(trace && trace.__resultPayload && trace.__resultPayload.mode) || 'desktop_result'
    });
  }
  return refs;
}

function buildTelemetrySignals(trace, slice, priorContextSummary, assistantReply, userMessage) {
  const retrievalRefs = Array.isArray(trace && trace.retrieval_refs) ? trace.retrieval_refs : [];
  const expectedRouting = Array.isArray(trace && trace.scenario_expectations && trace.scenario_expectations.expected_routing)
    ? trace.scenario_expectations.expected_routing.map((value) => normalizeToken(value)).filter(Boolean)
    : [];
  const inferredDomainIntent = inferConversationIntent(
    userMessage && userMessage.text,
    assistantReply && assistantReply.text,
    trace && trace.sent_text
  );
  const officialCheckTargets = deriveOfficialCheckTargets(assistantReply && assistantReply.text);
  const committedNextActions = deriveCommittedNextActions(assistantReply && assistantReply.text);
  const groundedCandidateAvailable = retrievalRefs.length > 0 || officialCheckTargets.length > 0 ? true : null;
  const explicitFollowupExpected = expectedRouting.includes('follow-up') || expectedRouting.includes('followup')
    ? true
    : (isExecuteMode(trace) ? false : null);
  const routeKind = expectedRouting[0]
    || normalizeToken(trace && trace.intent)
    || inferredDomainIntent
    || normalizeToken(trace && trace.target_id);

  return {
    routeKind,
    domainIntent: inferredDomainIntent || normalizeToken(trace && trace.scenario_id),
    normalizedConversationIntent: inferredDomainIntent || null,
    strategy: null,
    strategyReason: normalizeToken(trace && trace.failure_reason) || 'desktop_trace_observation',
    selectedCandidateKind: groundedCandidateAvailable === true ? 'grounded_candidate' : null,
    fallbackTemplateKind: null,
    finalizerTemplateKind: null,
    genericFallbackSlice: null,
    retrievalBlockedByStrategy: null,
    retrievalPermitReason: null,
    priorContextUsed: null,
    followupResolvedFromHistory: slice === 'follow-up' && priorContextSummary.available === true ? null : null,
    followupContinuityExpected: explicitFollowupExpected,
    transcriptSnapshotOutcome: assistantReply.available === true ? 'written' : 'skipped_unreviewable_transcript',
    transcriptSnapshotReason: assistantReply.available === true ? 'desktop_trace_observed' : 'assistant_reply_missing',
    transcriptSnapshotLineUserKeyAvailable: trace && trace.target_id ? true : null,
    transcriptSnapshotUserMessageAvailable: userMessage && userMessage.available === true,
    transcriptSnapshotAssistantReplyAvailable: assistantReply.available === true,
    transcriptSnapshotPriorContextSummaryAvailable: priorContextSummary.available === true,
    knowledgeCandidateUsed: groundedCandidateAvailable === true ? true : null,
    groundedCandidateAvailable,
    cityPackCandidateAvailable: null,
    cityPackUsedInAnswer: null,
    savedFaqCandidateAvailable: null,
    savedFaqUsedInAnswer: null,
    knowledgeGroundingKind: groundedCandidateAvailable === true
      ? (retrievalRefs.length > 0 ? 'desktop_trace_reference' : 'desktop_reply_reference')
      : null,
    readinessDecision: null,
    replyTemplateFingerprint: null,
    repeatRiskScore: 0,
    contextCarryScore: null,
    directAnswerApplied: assistantReply.available === true ? true : null,
    repetitionPrevented: null,
    conciseModeApplied: null,
    officialCheckTargets,
    committedNextActions,
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

function buildSyntheticTraceBundle(trace) {
  const traceId = normalizeText(trace && trace.run_id);
  if (!traceId) return null;
  const resultMode = normalizeText(trace && trace.__resultPayload && trace.__resultPayload.mode);
  return {
    ok: true,
    traceId,
    summary: {
      retrievalBlockReasons: [],
      retrievalPermitReasons: [],
      knowledgeRejectedReasons: [],
      cityPackRejectedReasons: [],
      savedFaqRejectedReasons: [],
      sourceReadinessDecisionSources: resultMode ? [`desktop_result:${resultMode}`] : ['line_desktop_patrol_trace'],
      fallbackTemplateKinds: [],
      finalizerTemplateKinds: [],
      replyTemplateFingerprints: []
    },
    traceJoinSummary: {
      completeness: 1,
      expectedDomains: ['line_desktop_patrol'],
      joinedDomains: ['line_desktop_patrol'],
      missingDomains: [],
      criticalMissingDomains: [],
      joinCounts: {
        lineDesktopPatrol: 1
      }
    }
  };
}

async function buildConversationReviewUnitsFromDesktopTrace(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const trace = payload.trace && typeof payload.trace === 'object'
    ? hydrateTraceWithResult(
      payload.trace,
      payload.result && typeof payload.result === 'object' ? payload.result : null,
      normalizeText(payload.tracePath) || null,
      null
    )
    : readTraceFile(payload.tracePath);
  const syntheticTraceBundle = buildSyntheticTraceBundle(trace);

  const sourceWindow = {
    fromAt: toIso(trace && trace.started_at),
    toAt: toIso(trace && trace.finished_at)
  };
  const slice = deriveSlice(trace);
  const userMessage = deriveUserMessage(trace);
  const assistantReply = deriveAssistantReply(trace);
  const priorContextSummary = derivePriorContextSummary(trace);
  const telemetrySignals = buildTelemetrySignals(trace, slice, priorContextSummary, assistantReply, userMessage);
  const executeBlockerCodes = isExecuteMode(trace) ? deriveExecuteBlockerCodes(trace) : [];
  const hasResultBridgeEvidence = Boolean(
    trace
    && trace.__resultPayload
    && (
      normalizeText(trace.__resultPayload.transcriptAfterReply)
      || normalizeVisibleRows(trace.__resultPayload.visibleAfter).length > 0
    )
  );
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
    hasActionLogEvidence: hasResultBridgeEvidence,
    expectsFaqEvidence: false,
    hasFaqEvidence: false,
    traceHydrationLimited: false,
    extraBlockerCodes: executeBlockerCodes
  });
  const evidenceRefs = buildEvidenceRefs(trace);
  const sourceCollections = Array.from(new Set(
    evidenceRefs
      .map((item) => item.source)
      .concat(['line_desktop_patrol_trace'])
      .concat(hasResultBridgeEvidence ? ['line_desktop_patrol_result'] : [])
      .concat(syntheticTraceBundle ? ['trace_bundle'] : [])
  ));
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
      actionLog: hasResultBridgeEvidence ? 'result_bridge' : 'missing_source',
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
    traceBundles: syntheticTraceBundle ? { bundles: [syntheticTraceBundle] } : { bundles: [] },
    transcriptCoverage: buildTranscriptCoverage(reviewUnit),
    sourceCollections,
    counts: {
      traces: 1,
      reviewUnits: 1,
      llmActionLogs: 0,
      faqAnswerLogs: 0,
      traceBundles: syntheticTraceBundle ? 1 : 0
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
