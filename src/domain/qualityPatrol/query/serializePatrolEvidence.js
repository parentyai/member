'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');
const {
  buildPatrolBacklogSeparation
} = require('./buildPatrolBacklogSeparation');

function slugifyEvidencePart(value, fallback) {
  const normalized = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return normalized || fallback;
}

function buildEvidenceKey(item, index) {
  const kind = slugifyEvidencePart(item && item.kind, 'summary');
  const provenance = slugifyEvidencePart(item && item.provenance, 'quality-patrol');
  return `qpe-${kind}-${provenance}-${index + 1}`;
}

function pushEvidence(rows, seen, item) {
  if (!item || typeof item !== 'object') return;
  const key = JSON.stringify([item.kind, item.summary, item.traceId || '', item.provenance || '']);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(Object.assign({
    evidenceKey: buildEvidenceKey(item, rows.length),
    traceId: null
  }, item));
}

function serializeMetricEvidence(metrics, audience, rows, seen) {
  Object.entries(metrics && typeof metrics === 'object' ? metrics : {}).forEach(([metricKey, metric]) => {
    if (!metric || metric.status === 'pass') return;
    const summary = audience === 'human'
      ? `${metricKey} に関する指標で注意が必要です。`
      : `${metricKey} status=${metric.status} value=${metric.value} sample=${metric.sampleCount}`;
    pushEvidence(rows, seen, {
      kind: 'metric',
      summary,
      provenance: metric.provenance || 'review_unit_evaluator',
      traceId: null
    });
  });
}

function serializeTranscriptCoverageEvidence(transcriptCoverage, audience, rows, seen) {
  const payload = transcriptCoverage && typeof transcriptCoverage === 'object' ? transcriptCoverage : null;
  if (!payload || payload.transcriptCoverageStatus === 'ready' || Number(payload.observedCount || 0) <= 0) return;
  const outcomeCounts = payload.transcriptWriteOutcomeCounts && typeof payload.transcriptWriteOutcomeCounts === 'object'
    ? payload.transcriptWriteOutcomeCounts
    : {};
  const failureReasons = payload.transcriptWriteFailureReasons && typeof payload.transcriptWriteFailureReasons === 'object'
    ? payload.transcriptWriteFailureReasons
    : {};
  const snapshotInputDiagnostics = payload.snapshotInputDiagnostics && typeof payload.snapshotInputDiagnostics === 'object'
    ? payload.snapshotInputDiagnostics
    : {};
  const diagnosticCounts = {
    assistant_reply_missing: Number.isFinite(Number(snapshotInputDiagnostics.assistant_reply_missing))
      ? Number(snapshotInputDiagnostics.assistant_reply_missing)
      : Number(snapshotInputDiagnostics.snapshotBuildSkippedReason && snapshotInputDiagnostics.snapshotBuildSkippedReason.assistant_reply_missing || 0),
    sanitized_reply_empty: Number.isFinite(Number(snapshotInputDiagnostics.sanitized_reply_empty))
      ? Number(snapshotInputDiagnostics.sanitized_reply_empty)
      : Number(snapshotInputDiagnostics.snapshotBuildSkippedReason && snapshotInputDiagnostics.snapshotBuildSkippedReason.sanitized_reply_empty || 0),
    masking_removed_text: Number.isFinite(Number(snapshotInputDiagnostics.masking_removed_text))
      ? Number(snapshotInputDiagnostics.masking_removed_text)
      : Number(snapshotInputDiagnostics.snapshotBuildSkippedReason && snapshotInputDiagnostics.snapshotBuildSkippedReason.masking_removed_text || 0),
    region_prompt_fallback: Number.isFinite(Number(snapshotInputDiagnostics.region_prompt_fallback))
      ? Number(snapshotInputDiagnostics.region_prompt_fallback)
      : Number(snapshotInputDiagnostics.snapshotBuildSkippedReason && snapshotInputDiagnostics.snapshotBuildSkippedReason.region_prompt_fallback || 0)
  };
  const summary = audience === 'human'
    ? '会話レビュー用 transcript 証跡の保存結果に欠落または失敗があり、一部の評価が保留です。'
    : `transcriptCoverage status=${payload.transcriptCoverageStatus} observed=${payload.observedCount} outcomes=${JSON.stringify(outcomeCounts)} reasons=${JSON.stringify(failureReasons)} snapshotDiagnostics=${JSON.stringify(diagnosticCounts)}`;
  pushEvidence(rows, seen, {
    kind: 'summary',
    summary,
    provenance: 'quality_patrol_transcript_coverage',
    traceId: null
  });
}

function serializeIssueEvidence(issues, audience, rows, seen) {
  (Array.isArray(issues) ? issues : []).forEach((issue) => {
    (Array.isArray(issue && issue.supportingEvidence) ? issue.supportingEvidence : []).forEach((evidence) => {
      const summary = audience === 'human'
        ? (evidence && evidence.summary ? String(evidence.summary) : `${issue.title} の判断材料があります。`)
        : JSON.stringify(evidence);
      pushEvidence(rows, seen, {
        kind: evidence && evidence.traceId ? 'trace' : 'signal',
        summary,
        provenance: issue && issue.provenance ? issue.provenance : 'quality_patrol_detection',
        traceId: audience === 'operator' && evidence && evidence.traceId ? String(evidence.traceId) : null
      });
    });
  });
}

function serializeRootCauseEvidence(rootCauseReports, audience, rows, seen) {
  (Array.isArray(rootCauseReports) ? rootCauseReports : []).forEach((report) => {
    const candidate = Array.isArray(report && report.causeCandidates) ? report.causeCandidates[0] : null;
    if (!candidate) return;
    pushEvidence(rows, seen, {
      kind: 'summary',
      summary: audience === 'human'
        ? (report && report.rootCauseSummary ? report.rootCauseSummary : '原因候補の分析があります。')
        : `${report && report.issueKey ? report.issueKey : 'issue'} => ${report && report.rootCauseSummary ? report.rootCauseSummary : 'root cause summary'}`,
      provenance: report && report.provenance ? report.provenance : 'quality_patrol_root_cause_analysis',
      traceId: null
    });
    (Array.isArray(candidate.supportingEvidence) ? candidate.supportingEvidence : []).forEach((evidence) => {
      pushEvidence(rows, seen, {
        kind: evidence && evidence.source === 'trace_bundle' ? 'trace' : 'summary',
        summary: audience === 'human'
          ? (evidence && evidence.summary ? String(evidence.summary) : '原因候補を支える材料があります。')
          : JSON.stringify(evidence),
        provenance: report && report.provenance ? report.provenance : 'quality_patrol_root_cause_analysis',
        traceId: audience === 'operator' && evidence && evidence.traceId ? String(evidence.traceId) : null
      });
    });
  });
}

function serializeJoinDiagnostics(joinDiagnostics, audience, rows, seen) {
  const payload = joinDiagnostics && typeof joinDiagnostics === 'object' ? joinDiagnostics : null;
  if (!payload || audience !== 'operator') return;
  const skipped = Number.isFinite(Number(payload.faqOnlyRowsSkipped)) ? Number(payload.faqOnlyRowsSkipped) : 0;
  const limited = Number.isFinite(Number(payload.traceHydrationLimitedCount)) ? Number(payload.traceHydrationLimitedCount) : 0;
  const anchorKindCounts = payload.reviewUnitAnchorKindCounts && typeof payload.reviewUnitAnchorKindCounts === 'object'
    ? payload.reviewUnitAnchorKindCounts
    : {};
  if (skipped <= 0 && limited <= 0 && Object.keys(anchorKindCounts).length === 0) return;

  pushEvidence(rows, seen, {
    kind: 'summary',
    summary: `review_unit_join faqOnlyRowsSkipped=${skipped} traceHydrationLimitedCount=${limited} anchorKinds=${JSON.stringify(anchorKindCounts)}`,
    provenance: 'quality_patrol_review_unit_join',
    traceId: null
  });
}

function serializeDecayAwareReadiness(decayAwareReadiness, audience, rows, seen) {
  const payload = decayAwareReadiness && typeof decayAwareReadiness === 'object' ? decayAwareReadiness : null;
  if (!payload) return;
  const recent = payload.recentWindow && typeof payload.recentWindow === 'object' ? payload.recentWindow : null;
  const full = payload.fullWindow && typeof payload.fullWindow === 'object' ? payload.fullWindow : null;
  const delta = payload.deltaFromPreviousFullWindow && typeof payload.deltaFromPreviousFullWindow === 'object'
    ? payload.deltaFromPreviousFullWindow
    : null;
  if (!recent || !full) return;

  const summary = audience === 'human'
    ? (payload.overallReadinessStatus === 'historical_backlog_dominant'
      ? '最近の観測では現在の応答経路は安定していますが、過去期間の証跡不足が残っています。'
      : (payload.overallReadinessStatus === 'observation_continue_backlog_decay'
        ? '最近の観測では現在の応答経路は安定しており、過去期間の証跡不足も少しずつ減っています。'
        : (payload.overallReadinessStatus === 'current_runtime_or_current_join_problem'
          ? '最近の観測でも現在の応答経路または証跡結合に不足が残っています。'
          : '最近と全体の観測が安定し、readiness の再判定候補です。')))
    : `decayAwareReadiness overall=${payload.overallReadinessStatus} recent=${payload.recentWindowStatus} historical=${payload.historicalBacklogStatus} recentWindow=${JSON.stringify({
      observedCount: recent.observedCount,
      written: recent.written,
      skipped_unreviewable_transcript: recent.skipped_unreviewable_transcript,
      assistant_reply_missing: recent.assistant_reply_missing,
      reviewUnitCount: recent.reviewUnitCount,
      faqOnlyRowsSkipped: recent.faqOnlyRowsSkipped,
      traceHydrationLimitedCount: recent.traceHydrationLimitedCount,
      blockerCount: recent.blockerCount
    })} fullWindow=${JSON.stringify({
      observedCount: full.observedCount,
      written: full.written,
      skipped_unreviewable_transcript: full.skipped_unreviewable_transcript,
      assistant_reply_missing: full.assistant_reply_missing,
      reviewUnitCount: full.reviewUnitCount,
      faqOnlyRowsSkipped: full.faqOnlyRowsSkipped,
      traceHydrationLimitedCount: full.traceHydrationLimitedCount,
      blockerCount: full.blockerCount
    })} delta=${JSON.stringify(delta || {})}`;

  pushEvidence(rows, seen, {
    kind: 'summary',
    summary,
    provenance: 'quality_patrol_decay_readiness',
    traceId: null
  });
}

function serializeDecayAwareOpsGate(decayAwareOpsGate, audience, rows, seen) {
  const payload = decayAwareOpsGate && typeof decayAwareOpsGate === 'object' ? decayAwareOpsGate : null;
  if (!payload) return;
  const summary = audience === 'human'
    ? (payload.decision === 'GO'
      ? '最近と全体の観測が安定し、readiness の再判定候補です。'
      : (payload.decision === 'OBSERVATION_CONTINUE'
        ? '最近の観測は安定しており、過去期間の負債が減っているため、もう少し観測を続けます。'
        : (payload.decisionReasonCode === 'historical_backlog_dominant'
          ? '最近の観測は安定していますが、過去期間の負債が残るため、いまは readiness を見送ります。'
          : '最近の観測でも現在の応答経路または結合証跡に不足があるため、いまは readiness を見送ります。')))
    : `decayAwareOpsGate decision=${payload.decision} reason=${payload.decisionReasonCode} operatorAction=${payload.operatorAction} recent=${payload.recentWindowStatus} historical=${payload.historicalBacklogStatus} overall=${payload.overallReadinessStatus} prD=${payload.prDStatus}:${payload.prDReasonCode}`;
  pushEvidence(rows, seen, {
    kind: 'summary',
    summary,
    provenance: 'quality_patrol_decay_ops_gate',
    traceId: null
  });
}

function serializeBacklogSeparation(decayAwareReadiness, decayAwareOpsGate, audience, rows, seen) {
  const structuredSummary = buildPatrolBacklogSeparation({
    audience,
    decayAwareReadiness,
    decayAwareOpsGate
  });
  const currentRuntime = structuredSummary && structuredSummary.currentRuntime && typeof structuredSummary.currentRuntime === 'object'
    ? structuredSummary.currentRuntime
    : null;
  const historicalDebt = structuredSummary && structuredSummary.historicalDebt && typeof structuredSummary.historicalDebt === 'object'
    ? structuredSummary.historicalDebt
    : null;
  const gate = structuredSummary && structuredSummary.backlogSeparationGate && typeof structuredSummary.backlogSeparationGate === 'object'
    ? structuredSummary.backlogSeparationGate
    : null;
  if (!currentRuntime || !historicalDebt || !gate) return;

  const summary = audience === 'human'
    ? `現在の runtime は ${currentRuntime.status}、過去期間の負債は ${historicalDebt.status}、判定は ${gate.decision} です。`
    : `backlogSeparation decision=${gate.decision} currentRuntime=${currentRuntime.status} historicalDebt=${historicalDebt.status} debtCounts=${JSON.stringify(historicalDebt.debtCounts || {})} prD=${gate.prDStatus}`;
  pushEvidence(rows, seen, {
    kind: 'summary',
    summary,
    structuredSummary,
    provenance: 'quality_patrol_backlog_separation',
    traceId: null
  });
}

function serializePatrolEvidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(30, Math.floor(Number(payload.limit)))) : 12;
  const rows = [];
  const seen = new Set();

  serializeDecayAwareReadiness(payload.decayAwareReadiness, audience, rows, seen);
  serializeDecayAwareOpsGate(payload.decayAwareOpsGate, audience, rows, seen);
  serializeBacklogSeparation(payload.decayAwareReadiness, payload.decayAwareOpsGate, audience, rows, seen);
  serializeJoinDiagnostics(payload.joinDiagnostics, audience, rows, seen);
  serializeMetricEvidence(payload.metrics, audience, rows, seen);
  serializeTranscriptCoverageEvidence(payload.transcriptCoverage, audience, rows, seen);
  serializeIssueEvidence(payload.issues, audience, rows, seen);
  serializeRootCauseEvidence(payload.rootCauseReports, audience, rows, seen);

  return rows.slice(0, limit);
}

module.exports = {
  serializePatrolEvidence
};
