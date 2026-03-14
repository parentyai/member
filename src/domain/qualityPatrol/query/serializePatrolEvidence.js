'use strict';

const crypto = require('node:crypto');
const { resolveAudienceView } = require('./resolveAudienceView');

function buildEvidenceKey(seed) {
  return `qpe_${crypto.createHash('sha256').update(seed, 'utf8').digest('hex').slice(0, 16)}`;
}

function pushEvidence(rows, seen, item) {
  if (!item || typeof item !== 'object') return;
  const key = JSON.stringify([item.kind, item.summary, item.traceId || '', item.provenance || '']);
  if (seen.has(key)) return;
  seen.add(key);
  rows.push(Object.assign({
    evidenceKey: buildEvidenceKey(key),
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
  const summary = audience === 'human'
    ? '会話レビュー用 transcript 証跡の保存結果に欠落または失敗があり、一部の評価が保留です。'
    : `transcriptCoverage status=${payload.transcriptCoverageStatus} observed=${payload.observedCount} outcomes=${JSON.stringify(outcomeCounts)} reasons=${JSON.stringify(failureReasons)}`;
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

function serializePatrolEvidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(30, Math.floor(Number(payload.limit)))) : 12;
  const rows = [];
  const seen = new Set();

  serializeMetricEvidence(payload.metrics, audience, rows, seen);
  serializeTranscriptCoverageEvidence(payload.transcriptCoverage, audience, rows, seen);
  serializeIssueEvidence(payload.issues, audience, rows, seen);
  serializeRootCauseEvidence(payload.rootCauseReports, audience, rows, seen);

  return rows.slice(0, limit);
}

module.exports = {
  serializePatrolEvidence
};
