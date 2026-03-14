'use strict';

function buildRootCauseReport(overrides) {
  return Object.assign({
    issueKey: 'issue_phase852_base',
    issueType: 'conversation_quality',
    slice: 'other',
    rootCauseSummary: 'Most likely cause: test root cause.',
    causeCandidates: [{
      causeType: 'knowledge_candidate_missing',
      confidence: 'high',
      rank: 1,
      supportingSignals: ['knowledge_candidate_not_available'],
      supportingEvidence: [{ source: 'kpi', metric: 'knowledgeActivationMissingRate', status: 'fail', value: 0.9 }],
      evidenceGaps: [],
      upstreamLayer: 'runtime_telemetry',
      downstreamImpact: ['knowledge_activation_missing']
    }],
    observationBlockers: [],
    analysisStatus: 'analyzed',
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {});
}

function buildRootCauseResult(overrides) {
  const report = buildRootCauseReport();
  return Object.assign({
    summary: {
      reportCount: 1,
      analyzedCount: 1,
      blockedCount: 0,
      insufficientEvidenceCount: 0,
      byAnalysisStatus: { analyzed: 1 },
      byCauseType: { knowledge_candidate_missing: 1 }
    },
    rootCauseReports: [report],
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {});
}

module.exports = {
  buildRootCauseReport,
  buildRootCauseResult
};
