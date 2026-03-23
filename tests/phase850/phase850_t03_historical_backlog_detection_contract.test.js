'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { buildManualKpiResult, buildMetricEnvelope } = require('./phase850_helpers');

test('phase850: historical backlog observation debt downgrades blockers and suppresses zero-sample unavailable metrics', () => {
  const missingUserMessage = {
    code: 'missing_user_message',
    severity: 'high',
    message: 'Masked user message snapshot is unavailable.',
    source: 'conversation_review_snapshots',
    slices: ['other']
  };
  const transcriptNotReviewable = {
    code: 'transcript_not_reviewable',
    severity: 'high',
    message: 'Conversation transcript is not reviewable because required masked text is missing.',
    source: 'conversation_review_snapshots',
    slices: ['other']
  };
  const result = detectIssues({
    kpiResult: buildManualKpiResult({
      metrics: {
        naturalness: buildMetricEnvelope(),
        continuity: buildMetricEnvelope(),
        specificity: buildMetricEnvelope({
          value: 0.14,
          sampleCount: 81,
          status: 'fail',
          observationBlockers: [missingUserMessage, transcriptNotReviewable]
        }, {
          other: {
            value: 0.14,
            sampleCount: 81,
            status: 'fail',
            observationBlockers: [missingUserMessage, transcriptNotReviewable]
          }
        }),
        proceduralUtility: buildMetricEnvelope(),
        knowledgeUse: buildMetricEnvelope(),
        fallbackRepetition: buildMetricEnvelope(),
        reviewableTranscriptRate: buildMetricEnvelope({
          value: 0.81,
          sampleCount: 100,
          missingCount: 19,
          status: 'warn'
        }, {
          other: {
            value: 0.81,
            sampleCount: 100,
            missingCount: 19,
            status: 'warn'
          }
        }),
        userMessageAvailableRate: buildMetricEnvelope({
          value: 0.81,
          sampleCount: 100,
          missingCount: 19,
          status: 'warn'
        }, {
          other: {
            value: 0.81,
            sampleCount: 100,
            missingCount: 19,
            status: 'warn'
          }
        }),
        assistantReplyAvailableRate: buildMetricEnvelope(),
        priorContextSummaryAvailableRate: buildMetricEnvelope({
          value: 0,
          sampleCount: 0,
          status: 'unavailable'
        }),
        transcriptAvailability: buildMetricEnvelope(),
        observationBlockerRate: buildMetricEnvelope({
          value: 0.19,
          sampleCount: 100,
          blockedCount: 19,
          status: 'warn',
          observationBlockers: [missingUserMessage, transcriptNotReviewable]
        }, {
          other: {
            value: 0.19,
            sampleCount: 100,
            blockedCount: 19,
            status: 'warn',
            observationBlockers: [missingUserMessage, transcriptNotReviewable]
          }
        }),
        blockedFollowupJudgementRate: buildMetricEnvelope({
          value: 0,
          sampleCount: 0,
          status: 'unavailable'
        }),
        blockedKnowledgeJudgementRate: buildMetricEnvelope()
      },
      issueCandidateMetrics: {
        broadAbstractEscapeRate: buildMetricEnvelope(),
        followupContextResetRate: buildMetricEnvelope(),
        citySpecificityMissingRate: buildMetricEnvelope(),
        nextStepMissingRate: buildMetricEnvelope(),
        repeatedTemplateResponseRate: buildMetricEnvelope(),
        knowledgeActivationMissingRate: buildMetricEnvelope(),
        savedFaqUnusedRate: buildMetricEnvelope(),
        cityPackUnusedRate: buildMetricEnvelope()
      },
      decayAwareReadiness: {
        overallReadinessStatus: 'historical_backlog_dominant',
        currentRuntimeHealth: {
          status: 'healthy'
        }
      }
    })
  });

  const transcriptIssue = result.issueCandidates.find((item) => item.metricKey === 'reviewableTranscriptRate' && item.slice === 'global');
  assert.ok(transcriptIssue);
  assert.equal(transcriptIssue.status, 'watching');
  assert.equal(transcriptIssue.historicalOnly, true);

  const blockerIssue = result.issueCandidates.find((item) => item.metricKey === 'observationBlockerRate' && item.slice === 'global');
  assert.ok(blockerIssue);
  assert.equal(blockerIssue.status, 'watching');
  assert.equal(blockerIssue.historicalOnly, true);

  const specificityIssue = result.issueCandidates.find((item) => item.metricKey === 'specificity' && item.slice === 'global');
  assert.ok(specificityIssue);
  assert.deepEqual(specificityIssue.observationBlockers, []);
  assert.equal(specificityIssue.historicalOnly, true);

  assert.equal(
    result.issueCandidates.some((item) => item.metricKey === 'priorContextSummaryAvailableRate'),
    false
  );
  assert.equal(
    result.issueCandidates.some((item) => item.metricKey === 'blockedFollowupJudgementRate'),
    false
  );
});
