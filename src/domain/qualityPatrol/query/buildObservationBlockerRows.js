'use strict';

const crypto = require('node:crypto');
const { resolveAudienceView } = require('./resolveAudienceView');

const TRANSCRIPT_BLOCKER_CODES = new Set([
  'missing_user_message',
  'missing_assistant_reply',
  'transcript_not_reviewable'
]);

const RUNTIME_INSUFFICIENT_CODES = new Set([
  'missing_prior_context_summary',
  'missing_faq_evidence',
  'insufficient_context_for_followup_judgement',
  'insufficient_knowledge_signals',
  'insufficient_trace_evidence'
]);

const SORT_RANK = Object.freeze({
  observation_gap: 0,
  transcript_write_coverage_missing: 1,
  action_trace_join_limited: 2,
  action_log_source_missing: 3,
  trace_source_missing: 4,
  insufficient_runtime_evidence: 5
});

function buildKey(parts) {
  return `qpb_${crypto.createHash('sha256').update(parts.join('|'), 'utf8').digest('hex').slice(0, 16)}`;
}

function toCode(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function normalizeSlice(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function shouldHideInternalDetail(audience) {
  return resolveAudienceView(audience) === 'human';
}

function collectRawBlockers(payload) {
  const rows = [];

  (Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : []).forEach((report) => {
    if (report && report.historicalOnly === true) return;
    const slice = normalizeSlice(report && report.slice);
    (Array.isArray(report && report.observationBlockers) ? report.observationBlockers : []).forEach((blocker) => {
      rows.push({
        code: toCode(blocker && blocker.code),
        message: blocker && blocker.message ? String(blocker.message) : '',
        source: blocker && blocker.source ? String(blocker.source) : '',
        slice,
        origin: 'root_cause'
      });
    });
  });

  (Array.isArray(payload.planObservationBlockers) ? payload.planObservationBlockers : []).forEach((blocker) => {
    rows.push({
      code: toCode(blocker && blocker.code),
      message: blocker && blocker.message ? String(blocker.message) : '',
      source: blocker && blocker.source ? String(blocker.source) : '',
      slice: null,
      origin: 'planner'
    });
  });

  (Array.isArray(payload.issues) ? payload.issues : []).forEach((issue) => {
    if (issue && issue.historicalOnly === true) return;
    const slice = normalizeSlice(issue && issue.slice);
    (Array.isArray(issue && issue.observationBlockers) ? issue.observationBlockers : []).forEach((blocker) => {
      rows.push({
        code: toCode(blocker && blocker.code),
        message: blocker && blocker.message ? String(blocker.message) : '',
        source: blocker && blocker.source ? String(blocker.source) : '',
        slice,
        origin: 'issue'
      });
    });
  });

  return rows.filter((row) => row.code);
}

function collectSlices(rows) {
  const slices = uniqueStrings((Array.isArray(rows) ? rows : []).map((row) => row && row.slice ? row.slice : null));
  return slices.length > 0 ? slices : ['global'];
}

function summarizeRawCodes(rows) {
  return uniqueStrings((Array.isArray(rows) ? rows : []).map((row) => row && row.code ? row.code : null));
}

function hasObservationGap(payload) {
  const rootCauseGap = (Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : []).some((report) =>
    (Array.isArray(report && report.causeCandidates) ? report.causeCandidates : []).some((candidate) => toCode(candidate && candidate.causeType) === 'observation_gap')
  );
  const proposalGap = (Array.isArray(payload.recommendedPr) ? payload.recommendedPr : []).some((proposal) =>
    toCode(proposal && proposal.proposalType) === 'blocked_by_observation_gap'
  );
  return rootCauseGap || proposalGap || toCode(payload.planningStatus) === 'blocked';
}

function hasJoinLimitedSignal(payload) {
  const diagnostics = payload.joinDiagnostics && typeof payload.joinDiagnostics === 'object' ? payload.joinDiagnostics : {};
  const traceHydrationLimitedCount = Number.isFinite(Number(diagnostics.traceHydrationLimitedCount))
    ? Number(diagnostics.traceHydrationLimitedCount)
    : 0;
  const limitedReviewUnit = (Array.isArray(payload.reviewUnits) ? payload.reviewUnits : []).some((unit) =>
    unit && unit.evidenceJoinStatus && unit.evidenceJoinStatus.trace === 'limited_by_trace_hydration'
  );
  const missingTraceLike = (Array.isArray(payload.rawBlockers) ? payload.rawBlockers : []).some((row) =>
    row && (row.code === 'missing_trace_evidence' || row.code === 'missing_action_log_evidence')
  );
  const faqSkipped = Number.isFinite(Number(diagnostics.faqOnlyRowsSkipped)) ? Number(diagnostics.faqOnlyRowsSkipped) : 0;
  return traceHydrationLimitedCount > 0 || limitedReviewUnit || (faqSkipped > 0 && missingTraceLike);
}

function hasTranscriptCoverageGap(payload) {
  const coverage = payload.transcriptCoverage && typeof payload.transcriptCoverage === 'object'
    ? payload.transcriptCoverage
    : {};
  const status = toCode(coverage.transcriptCoverageStatus);
  if (!status || status === 'unavailable') {
    return Number.isFinite(Number(coverage.observedCount)) ? Number(coverage.observedCount) <= 0 : true;
  }
  if (status !== 'ready') return true;
  const outcomeCounts = coverage.transcriptWriteOutcomeCounts && typeof coverage.transcriptWriteOutcomeCounts === 'object'
    ? coverage.transcriptWriteOutcomeCounts
    : {};
  const problematicOutcomes = [
    'skipped_flag_disabled',
    'skipped_missing_line_user_key',
    'skipped_unreviewable_transcript',
    'failed_repo_write',
    'failed_unknown'
  ];
  return problematicOutcomes.some((key) => Number(outcomeCounts[key] || 0) > 0);
}

function buildObservationGapRow(payload, audience, rows) {
  const human = shouldHideInternalDetail(audience);
  return {
    blockerKey: buildKey(['observation_gap']),
    code: 'observation_gap',
    category: 'observation_gap',
    title: human
      ? 'まだ断定できない理由: 観測不足が重なっています'
      : 'Observation gap is blocking runtime attribution',
    summary: human
      ? '証跡不足が重なっているため、改善策の断定はまだ保留です。'
      : `Multiple observation blockers are preventing confident runtime attribution. blockerCodes=${JSON.stringify(summarizeRawCodes(rows))}`,
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? '下の観測不足を解消してから、改善提案の優先順位を判断してください。'
      : 'Resolve the concrete observation blockers below before opening runtime-repair work.',
    evidenceSource: 'quality_patrol_root_cause_analysis',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : summarizeRawCodes(rows)
  };
}

function buildTranscriptCoverageRow(payload, audience, rows) {
  const human = shouldHideInternalDetail(audience);
  const coverage = payload.transcriptCoverage && typeof payload.transcriptCoverage === 'object' ? payload.transcriptCoverage : {};
  const observedCount = Number.isFinite(Number(coverage.observedCount)) ? Number(coverage.observedCount) : 0;
  const outcomeCounts = coverage.transcriptWriteOutcomeCounts && typeof coverage.transcriptWriteOutcomeCounts === 'object'
    ? coverage.transcriptWriteOutcomeCounts
    : {};
  const failureReasons = coverage.transcriptWriteFailureReasons && typeof coverage.transcriptWriteFailureReasons === 'object'
    ? coverage.transcriptWriteFailureReasons
    : {};

  return {
    blockerKey: buildKey(['transcript_write_coverage_missing']),
    code: 'transcript_write_coverage_missing',
    category: 'write_coverage_missing',
    title: human
      ? 'まだ断定できない理由: 会話本文の記録が十分ではありません'
      : 'Transcript write coverage is missing',
    summary: human
      ? 'ユーザー発話またはアシスタント返信の記録が十分にそろわず、会話内容の評価を確定できません。'
      : observedCount > 0
        ? `Masked transcript coverage is insufficient. observed=${observedCount} outcomes=${JSON.stringify(outcomeCounts)} reasons=${JSON.stringify(failureReasons)}`
        : 'Masked transcript coverage is insufficient and no transcript write outcomes have been observed yet.',
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? '会話レビュー用の transcript 記録が取れているか確認してから、応答品質の改善策を判断してください。'
      : 'Recover masked transcript snapshot coverage before opening runtime-quality repairs.',
    evidenceSource: 'quality_patrol_transcript_coverage',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : summarizeRawCodes(rows)
  };
}

function buildJoinLimitedRow(payload, audience, rows) {
  const human = shouldHideInternalDetail(audience);
  const diagnostics = payload.joinDiagnostics && typeof payload.joinDiagnostics === 'object' ? payload.joinDiagnostics : {};
  const skipped = Number.isFinite(Number(diagnostics.faqOnlyRowsSkipped)) ? Number(diagnostics.faqOnlyRowsSkipped) : 0;
  const limited = Number.isFinite(Number(diagnostics.traceHydrationLimitedCount)) ? Number(diagnostics.traceHydrationLimitedCount) : 0;
  const anchorKinds = diagnostics.reviewUnitAnchorKindCounts && typeof diagnostics.reviewUnitAnchorKindCounts === 'object'
    ? diagnostics.reviewUnitAnchorKindCounts
    : {};

  return {
    blockerKey: buildKey(['action_trace_join_limited']),
    code: 'action_trace_join_limited',
    category: 'join_limited',
    title: human
      ? 'まだ断定できない理由: 行動ログと trace の結合に制約があります'
      : 'Action and trace evidence are join-limited',
    summary: human
      ? '行動ログや trace はありますが、品質評価に結び付く形で十分に集約できていない証跡があります。'
      : `Review-unit join is limited. faqOnlyRowsSkipped=${skipped} traceHydrationLimitedCount=${limited} anchorKinds=${JSON.stringify(anchorKinds)}`,
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? '行動ログや trace を review unit に結び付けられる条件を確認してから、原因の断定に進んでください。'
      : 'Investigate anchor conditions and trace hydration limits before treating this as a source-missing defect.',
    evidenceSource: 'quality_patrol_review_unit_join',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : summarizeRawCodes(rows)
  };
}

function buildSourceMissingRow(code, audience, rows) {
  const human = shouldHideInternalDetail(audience);
  if (code === 'action_log_source_missing') {
    return {
      blockerKey: buildKey(['action_log_source_missing']),
      code,
      category: 'source_missing',
      title: human
        ? 'まだ断定できない理由: 操作ログの証跡が不足しています'
        : 'Action-log evidence is missing at the source level',
      summary: human
        ? '応答の処理経路を確認するための操作ログが足りず、原因の断定を進められません。'
        : 'Anchored review units expected action-log evidence, but no action-log source was joined.',
      affectedSlices: collectSlices(rows),
      recommendedAction: human
        ? '操作ログの取得状況を確認してから、runtime 改修の要否を判断してください。'
        : 'Verify action-log emission and read-path coverage before attributing runtime causes.',
      evidenceSource: 'llm_action_logs',
      privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
      detailVisibility: human ? 'privacy_hidden_detail' : 'full',
      sourceCodes: human ? undefined : summarizeRawCodes(rows)
    };
  }

  return {
    blockerKey: buildKey(['trace_source_missing']),
    code: 'trace_source_missing',
    category: 'source_missing',
    title: human
      ? 'まだ断定できない理由: trace の証跡が不足しています'
      : 'Trace evidence is missing at the source level',
    summary: human
      ? '内部処理の根拠を追う trace が足りず、原因の断定を進められません。'
      : 'Anchored review units expected trace evidence, but no usable trace bundle was joined.',
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? 'trace の取得状況を確認してから、runtime 改修の要否を判断してください。'
      : 'Verify anchored trace-bundle availability before attributing runtime causes.',
    evidenceSource: 'trace_bundle',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : summarizeRawCodes(rows)
  };
}

function buildInsufficientEvidenceRow(audience, rows) {
  const human = shouldHideInternalDetail(audience);
  const sourceCodes = summarizeRawCodes(rows);
  const reasons = [];
  if (sourceCodes.includes('missing_prior_context_summary') || sourceCodes.includes('insufficient_context_for_followup_judgement')) {
    reasons.push('prior_context');
  }
  if (sourceCodes.includes('missing_faq_evidence') || sourceCodes.includes('insufficient_knowledge_signals')) {
    reasons.push('knowledge_signals');
  }
  if (sourceCodes.includes('insufficient_trace_evidence')) {
    reasons.push('trace_completeness');
  }

  return {
    blockerKey: buildKey(['insufficient_runtime_evidence']),
    code: 'insufficient_runtime_evidence',
    category: 'insufficient_evidence',
    title: human
      ? 'まだ断定できない理由: runtime 判断材料が足りません'
      : 'Runtime evidence is insufficient for confident judgement',
    summary: human
      ? '一部の証跡はありますが、原因を断定できるほど十分ではありません。'
      : `Runtime evidence exists but is insufficient for confident judgement. reasons=${JSON.stringify(uniqueStrings(reasons))} rawCodes=${JSON.stringify(sourceCodes)}`,
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? '不足している文脈・知識候補・trace の証跡を補ってから、原因判断を進めてください。'
      : 'Collect the missing context, knowledge, or trace signals before opening runtime-fix work.',
    evidenceSource: 'conversation_quality_evaluator',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : sourceCodes
  };
}

function buildFallbackRow(audience, rows) {
  const human = shouldHideInternalDetail(audience);
  const sourceCodes = summarizeRawCodes(rows);
  return {
    blockerKey: buildKey(['observation_blocker_fallback', sourceCodes.join(',')]),
    code: sourceCodes[0] || 'observation_gap',
    category: 'observation_blocker',
    title: human
      ? 'まだ断定できない理由: 観測証跡が不足しています'
      : 'Observation blocker is still active',
    summary: human
      ? (rows[0] && rows[0].message ? rows[0].message : '観測証跡が不足しているため、断定を保留しています。')
      : (rows[0] && rows[0].message ? rows[0].message : `Observation blocker remains active. rawCodes=${JSON.stringify(sourceCodes)}`),
    affectedSlices: collectSlices(rows),
    recommendedAction: human
      ? '不足している証跡を補ってから、改善提案の優先順位を判断してください。'
      : 'Resolve the observation blocker before opening runtime repair work.',
    evidenceSource: rows[0] && rows[0].source ? rows[0].source : 'quality_patrol_query',
    privacySensitivity: human ? 'privacy_hidden_detail' : 'low',
    detailVisibility: human ? 'privacy_hidden_detail' : 'full',
    sourceCodes: human ? undefined : sourceCodes
  };
}

function sortRows(rows) {
  return rows.slice().sort((left, right) => {
    const leftRank = Object.prototype.hasOwnProperty.call(SORT_RANK, left.code) ? SORT_RANK[left.code] : 99;
    const rightRank = Object.prototype.hasOwnProperty.call(SORT_RANK, right.code) ? SORT_RANK[right.code] : 99;
    if (leftRank !== rightRank) return leftRank - rightRank;
    return left.title.localeCompare(right.title, 'ja');
  });
}

function withOperatorSourceCodes(row, audience, codes) {
  const base = Object.assign({}, row);
  delete base.sourceCodes;
  if (shouldHideInternalDetail(audience)) return base;
  return Object.assign(base, {
    sourceCodes: uniqueStrings(codes)
  });
}

function buildObservationBlockerRows(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const rawBlockers = collectRawBlockers(payload);
  const rows = [];

  const transcriptRows = rawBlockers.filter((row) => TRANSCRIPT_BLOCKER_CODES.has(row.code));
  const insufficientRows = rawBlockers.filter((row) => RUNTIME_INSUFFICIENT_CODES.has(row.code));
  const actionMissingRows = rawBlockers.filter((row) => row.code === 'missing_action_log_evidence');
  const traceMissingRows = rawBlockers.filter((row) => row.code === 'missing_trace_evidence');
  const joinLimited = hasJoinLimitedSignal(Object.assign({}, payload, { rawBlockers }));

  if (hasObservationGap(payload) && rawBlockers.length > 0) {
    rows.push(buildObservationGapRow(payload, audience, rawBlockers));
  }

  if (transcriptRows.length > 0 && hasTranscriptCoverageGap(payload)) {
    rows.push(buildTranscriptCoverageRow(payload, audience, transcriptRows));
  }

  if (joinLimited) {
    rows.push(buildJoinLimitedRow(payload, audience, rawBlockers.filter((row) =>
      row.code === 'missing_trace_evidence' || row.code === 'missing_action_log_evidence'
    )));
  }

  if (actionMissingRows.length > 0 && !joinLimited) {
    rows.push(buildSourceMissingRow('action_log_source_missing', audience, actionMissingRows));
  }

  if (traceMissingRows.length > 0 && !joinLimited) {
    rows.push(buildSourceMissingRow('trace_source_missing', audience, traceMissingRows));
  }

  if (insufficientRows.length > 0) {
    rows.push(buildInsufficientEvidenceRow(audience, insufficientRows));
  }

  if (!rows.length && rawBlockers.length > 0) {
    rows.push(buildFallbackRow(audience, rawBlockers));
  }

  return sortRows(rows).map((row) => withOperatorSourceCodes(row, audience, row.sourceCodes || []));
}

module.exports = {
  buildObservationBlockerRows
};
