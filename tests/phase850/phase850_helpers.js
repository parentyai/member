'use strict';

const { buildPatrolKpis } = require('../../src/domain/qualityPatrol/buildPatrolKpis');
const { evaluateConversationQuality } = require('../../src/domain/qualityPatrol/evaluateConversationQuality');
const { buildReviewUnit } = require('../phase849/phase849_helpers');

function evaluateReviewUnit(overrides) {
  const reviewUnit = buildReviewUnit(overrides);
  return {
    reviewUnit,
    evaluation: evaluateConversationQuality(reviewUnit)
  };
}

function buildKpiResultFromEntries(entries) {
  const rows = Array.isArray(entries) ? entries : [];
  return buildPatrolKpis({
    reviewUnits: rows.map((item) => item.reviewUnit),
    evaluations: rows.map((item) => item.evaluation)
  });
}

function buildMetricEnvelope(overrides, sliceOverrides) {
  const bySliceInput = Object.assign({
    broad: { value: 0, sampleCount: 0, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'unavailable' },
    housing: { value: 0, sampleCount: 0, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'unavailable' },
    city: { value: 0, sampleCount: 0, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'unavailable' },
    'follow-up': { value: 0, sampleCount: 0, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'unavailable' },
    other: { value: 0, sampleCount: 0, missingCount: 0, falseCount: 0, blockedCount: 0, unavailableCount: 0, status: 'unavailable' }
  }, sliceOverrides || {});
  return Object.assign({
    value: 0,
    sampleCount: 0,
    missingCount: 0,
    falseCount: 0,
    blockedCount: 0,
    unavailableCount: 0,
    status: 'unavailable',
    provenance: 'review_unit_evaluator',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs'],
    observationBlockers: [],
    bySlice: Object.keys(bySliceInput).map((slice) => Object.assign({ slice }, bySliceInput[slice]))
  }, overrides || {});
}

function buildManualKpiResult(overrides) {
  const defaultMetric = () => buildMetricEnvelope();
  return Object.assign({
    summary: {
      overallStatus: 'warn',
      reviewUnitCount: 0,
      sliceCounts: {
        broad: 0,
        housing: 0,
        city: 0,
        'follow-up': 0,
        other: 0
      }
    },
    metrics: {
      naturalness: defaultMetric(),
      continuity: defaultMetric(),
      specificity: defaultMetric(),
      proceduralUtility: defaultMetric(),
      knowledgeUse: defaultMetric(),
      fallbackRepetition: defaultMetric(),
      reviewableTranscriptRate: defaultMetric(),
      userMessageAvailableRate: defaultMetric(),
      assistantReplyAvailableRate: defaultMetric(),
      priorContextSummaryAvailableRate: defaultMetric(),
      transcriptAvailability: defaultMetric(),
      observationBlockerRate: defaultMetric(),
      blockedFollowupJudgementRate: defaultMetric(),
      blockedKnowledgeJudgementRate: defaultMetric()
    },
    issueCandidateMetrics: {
      broadAbstractEscapeRate: defaultMetric(),
      followupContextResetRate: defaultMetric(),
      citySpecificityMissingRate: defaultMetric(),
      nextStepMissingRate: defaultMetric(),
      repeatedTemplateResponseRate: defaultMetric(),
      knowledgeActivationMissingRate: defaultMetric(),
      savedFaqUnusedRate: defaultMetric(),
      cityPackUnusedRate: defaultMetric()
    },
    observationBlockers: [],
    provenance: 'review_unit_evaluator',
    sourceCollections: ['conversation_review_snapshots', 'llm_action_logs']
  }, overrides || {});
}

module.exports = {
  evaluateReviewUnit,
  buildKpiResultFromEntries,
  buildMetricEnvelope,
  buildManualKpiResult
};
