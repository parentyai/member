'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIssues } = require('../../src/domain/qualityPatrol/detectIssues');
const { buildManualKpiResult, buildMetricEnvelope } = require('./phase850_helpers');

test('phase850: missing-driven coverage issues stay watching while unavailable metrics stay blocked', () => {
  const kpiResult = buildManualKpiResult({
    metrics: {
      naturalness: buildMetricEnvelope(),
      continuity: buildMetricEnvelope(),
      specificity: buildMetricEnvelope(),
      proceduralUtility: buildMetricEnvelope(),
      knowledgeUse: buildMetricEnvelope(),
      fallbackRepetition: buildMetricEnvelope(),
      reviewableTranscriptRate: buildMetricEnvelope({
        value: 0,
        sampleCount: 0,
        missingCount: 0,
        falseCount: 0,
        blockedCount: 0,
        unavailableCount: 2,
        status: 'unavailable'
      }),
      userMessageAvailableRate: buildMetricEnvelope({
        value: 0.2,
        sampleCount: 5,
        missingCount: 4,
        falseCount: 0,
        blockedCount: 0,
        unavailableCount: 0,
        status: 'fail'
      }),
      assistantReplyAvailableRate: buildMetricEnvelope(),
      priorContextSummaryAvailableRate: buildMetricEnvelope(),
      transcriptAvailability: buildMetricEnvelope(),
      observationBlockerRate: buildMetricEnvelope(),
      blockedFollowupJudgementRate: buildMetricEnvelope(),
      blockedKnowledgeJudgementRate: buildMetricEnvelope()
    }
  });

  const result = detectIssues({ kpiResult });
  const unavailableIssue = result.issueCandidates.find((item) => item.metricKey === 'reviewableTranscriptRate');
  const missingCoverageIssue = result.issueCandidates.find((item) => item.metricKey === 'userMessageAvailableRate');

  assert.ok(unavailableIssue);
  assert.equal(unavailableIssue.status, 'blocked');
  assert.ok(missingCoverageIssue);
  assert.equal(missingCoverageIssue.status, 'watching');
});
