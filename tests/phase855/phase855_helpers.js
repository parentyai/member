'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function tempJsonPath(label) {
  return path.join(
    os.tmpdir(),
    `quality_patrol_${label}_${Date.now()}_${Math.random().toString(16).slice(2)}.json`
  );
}

function cleanupPaths() {
  Array.from(arguments).forEach((filePath) => {
    if (!filePath) return;
    try {
      fs.unlinkSync(filePath);
    } catch (_error) {
      // ignore cleanup errors in tests
    }
  });
}

function createReviewUnit() {
  return {
    reviewUnitId: 'ru_001',
    traceId: 'trace_quality_patrol_001',
    lineUserKey: 'line_user_key_001',
    sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
    slice: 'broad',
    userMessage: { text: '住まい探しの流れを教えてください', available: true },
    assistantReply: { text: 'まず条件整理、次に候補比較、最後に内見調整の順です。', available: true },
    priorContextSummary: { text: '', available: false },
    telemetrySignals: {
      strategyReason: 'broad housing overview',
      selectedCandidateKind: 'fallback',
      fallbackTemplateKind: 'generic_guidance_v1',
      finalizerTemplateKind: 'guided_steps_v1',
      genericFallbackSlice: 'broad',
      priorContextUsed: false,
      followupResolvedFromHistory: false,
      knowledgeCandidateUsed: false,
      cityPackUsedInAnswer: false,
      savedFaqUsedInAnswer: false,
      cityPackCandidateAvailable: false,
      savedFaqCandidateAvailable: false,
      groundedCandidateAvailable: true,
      replyTemplateFingerprint: 'fp_generic_steps_001'
    },
    observationBlockers: [],
    evidenceRefs: [{ source: 'llm_action_logs', traceId: 'trace_quality_patrol_001' }],
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'faq_answer_logs', 'trace_bundle']
  };
}

function createEvaluation() {
  return {
    reviewUnitId: 'ru_001',
    slice: 'broad',
    status: 'fail',
    observationBlockers: [],
    signals: {
      naturalness: { value: 0.72, status: 'warn', supportingSignals: [{ code: 'tone_template_bias' }] },
      continuity: { value: 0.82, status: 'pass', supportingSignals: [] },
      specificity: { value: 0.45, status: 'fail', supportingSignals: [{ code: 'specificity_low' }] },
      proceduralUtility: { value: 0.42, status: 'fail', supportingSignals: [{ code: 'next_step_missing' }] },
      knowledgeUse: { value: 0.35, status: 'fail', supportingSignals: [{ code: 'knowledge_unused' }] },
      fallbackRepetition: { value: 0.61, status: 'fail', supportingSignals: [{ code: 'repeat_template_fingerprint' }] }
    },
    issueCandidates: [
      {
        code: 'broad_abstract_escape',
        title: 'Broad question drifted into abstract fallback'
      }
    ],
    supportingEvidence: [
      {
        summary: 'broad slice answer stayed generic and lacked concrete next steps',
        traceId: 'trace_quality_patrol_001'
      }
    ],
    provenance: 'review_unit',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function createKpiResult() {
  return {
    summary: {
      overallStatus: 'fail',
      reviewUnitCount: 1,
      sliceCounts: { broad: 1 }
    },
    metrics: {
      naturalness: {
        value: 0.72,
        sampleCount: 1,
        missingCount: 0,
        falseCount: 0,
        blockedCount: 0,
        unavailableCount: 0,
        status: 'warn',
        provenance: 'review_unit_evaluator',
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
        observationBlockers: [],
        bySlice: { broad: { value: 0.72, sampleCount: 1, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'warn' } }
      },
      proceduralUtility: {
        value: 0.42,
        sampleCount: 1,
        missingCount: 0,
        falseCount: 1,
        blockedCount: 0,
        unavailableCount: 0,
        status: 'fail',
        provenance: 'review_unit_evaluator',
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
        observationBlockers: [],
        bySlice: { broad: { value: 0.42, sampleCount: 1, missingCount: 0, falseCount: 1, blockedCount: 0, unavailableCount: 0, status: 'fail' } }
      },
      transcriptAvailability: {
        value: 1,
        sampleCount: 1,
        missingCount: 0,
        falseCount: 0,
        blockedCount: 0,
        unavailableCount: 0,
        status: 'pass',
        provenance: 'review_unit_evaluator',
        sourceCollections: ['conversation_review_snapshots'],
        observationBlockers: [],
        bySlice: { broad: { value: 1, sampleCount: 1, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'pass' } }
      }
    },
    issueCandidateMetrics: {
      broadAbstractEscapeRate: {
        value: 1,
        sampleCount: 1,
        missingCount: 0,
        falseCount: 0,
        blockedCount: 0,
        unavailableCount: 0,
        status: 'fail',
        provenance: 'review_unit_evaluator',
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
        observationBlockers: [],
        bySlice: { broad: { value: 1, sampleCount: 1, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'fail' } }
      }
    },
    transcriptCoverage: {
      observedCount: 1,
      writtenCount: 1,
      skippedCount: 0,
      failedCount: 0,
      transcriptWriteOutcomeCounts: {
        written: 1,
        skipped_flag_disabled: 0,
        skipped_missing_line_user_key: 0,
        skipped_unreviewable_transcript: 0,
        failed_repo_write: 0,
        failed_unknown: 0
      },
      transcriptWriteFailureReasons: {},
      transcriptCoverageStatus: 'ready',
      sourceCollections: ['llm_action_logs']
    },
    observationBlockers: [],
    provenance: 'review_unit_evaluator',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function createDetectionResult() {
  return {
    summary: {
      issueCount: 1,
      blockedCount: 0,
      openCount: 1,
      watchingCount: 0,
      byType: { conversation_quality: 1 },
      bySlice: { broad: 1 }
    },
    issueCandidates: [
      {
        issueType: 'conversation_quality',
        issueKey: 'iq_broad_abstract_escape',
        title: 'Broad abstract escape',
        summary: 'Broad answers stay generic and skip next-step guidance.',
        severity: 'high',
        status: 'open',
        category: 'broad_abstract_escape',
        metricKey: 'broadAbstractEscapeRate',
        metricStatus: 'fail',
        slice: 'broad',
        provenance: 'quality_patrol_detection',
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
        observationBlockers: [],
        supportingSignals: ['specificity_low', 'procedural_utility_low'],
        supportingEvidence: [
          {
            summary: 'specificity=fail and proceduralUtility=fail for broad slice',
            traceId: 'trace_quality_patrol_001',
            value: 1,
            sampleCount: 1
          }
        ],
        recommendedBacklog: {
          title: 'Broaden broad-answer guidance',
          priority: 'P1',
          objective: 'Reduce generic broad answers and add clearer next steps.'
        }
      }
    ],
    backlogCandidates: [
      {
        backlogKey: 'backlog_broad_guidance',
        title: 'Broaden broad-answer guidance',
        priority: 'P1',
        objective: 'Reduce generic broad answers and add clearer next steps.',
        issueKeys: ['iq_broad_abstract_escape']
      }
    ],
    provenance: 'quality_patrol_detection',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function createRootCauseResult() {
  return {
    summary: {
      reportCount: 1,
      analyzedCount: 1,
      blockedCount: 0,
      insufficientEvidenceCount: 0,
      byAnalysisStatus: { analyzed: 1 },
      byCauseType: { procedural_guidance_gap: 1 }
    },
    rootCauseReports: [
      {
        issueKey: 'iq_broad_abstract_escape',
        issueType: 'conversation_quality',
        slice: 'broad',
        rootCauseSummary: 'Next-step guidance is not being carried into broad answers.',
        causeCandidates: [
          {
            causeType: 'procedural_guidance_gap',
            confidence: 'high',
            rank: 1,
            supportingSignals: ['procedural_utility_low'],
            supportingEvidence: [{ summary: 'procedural utility stayed below threshold', source: 'kpi' }],
            evidenceGaps: [],
            upstreamLayer: 'runtime_telemetry',
            downstreamImpact: ['next_step_missing']
          }
        ],
        observationBlockers: [],
        analysisStatus: 'analyzed',
        provenance: 'quality_patrol_root_cause_analysis',
        sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
      }
    ],
    provenance: 'quality_patrol_root_cause_analysis',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function createPlanResult() {
  return {
    planVersion: 'quality_patrol_improvement_plan_v1',
    generatedAt: '2026-03-14T18:55:00.000Z',
    summary: {
      topPriorityCount: 1,
      observationOnlyCount: 0,
      runtimeFixCount: 1
    },
    recommendedPr: [
      {
        proposalKey: 'proposal_broad_guidance',
        proposalType: 'continuity_fix',
        priority: 'P1',
        title: 'Strengthen broad guidance next-step flow',
        objective: 'Add deterministic next-step scaffolding for broad concierge answers.',
        whyNow: 'Broad answers are failing specificity and procedural utility together.',
        whyNotOthers: 'This addresses the highest-confidence cause before lower-confidence template changes.',
        rootCauseRefs: ['iq_broad_abstract_escape'],
        targetFiles: ['src/domain/llm/orchestrator/buildConversationPacket.js'],
        expectedImpact: ['proceduralUtility', 'specificity'],
        riskLevel: 'medium',
        rollbackPlan: ['Revert PR-10 follow-up guidance changes.'],
        preconditions: [],
        blockedBy: [],
        confidence: 'high',
        provenance: 'quality_patrol_improvement_planner'
      }
    ],
    observationBlockers: [],
    planningStatus: 'planned',
    provenance: 'quality_patrol_improvement_planner',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  };
}

function buildPatrolDeps(overrides) {
  const writeCalls = [];
  const deps = {
    buildConversationReviewUnitsFromSources: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
      reviewUnits: [createReviewUnit()],
      sourceCollections: ['conversation_review_snapshots', 'llm_action_logs', 'faq_answer_logs', 'trace_bundle'],
      counts: { snapshots: 1, llmActionLogs: 1, faqAnswerLogs: 1, traceBundles: 1 }
    }),
    evaluateConversationReviewUnits: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
      evaluations: [createEvaluation()],
      counts: { reviewUnits: 1, blocked: 0, fail: 1, warn: 0 },
      sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
    }),
    buildPatrolKpisFromEvaluations: async () => createKpiResult(),
    detectIssues: () => createDetectionResult(),
    analyzeQualityIssues: async () => createRootCauseResult(),
    planQualityImprovements: async () => createPlanResult(),
    listOpenIssues: async () => [],
    listTopPriorityBacklog: async () => [],
    detectAndUpsertQualityIssues: async (params) => {
      writeCalls.push(params);
      return {
        ok: true,
        persisted: params.persist === true,
        backlogPersisted: params.persistBacklog === true,
        upsertedIssues: params.persist === true ? [{ issueKey: 'iq_broad_abstract_escape', issueId: 'issue_001', created: true }] : [],
        upsertedBacklogs: params.persistBacklog === true ? [{ backlogKey: 'backlog_broad_guidance', backlogId: 'backlog_001', created: true }] : []
      };
    }
  };
  const merged = Object.assign({}, deps, overrides || {});
  merged.__writeCalls = writeCalls;
  return merged;
}

module.exports = {
  tempJsonPath,
  cleanupPaths,
  buildPatrolDeps
};
