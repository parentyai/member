'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildQualityFrameworkSummary,
  buildCounterexampleQueueFromBoards
} = require('../../src/routes/admin/osLlmUsageSummary');
const {
  classifyCounterexampleSignal
} = require('../../src/domain/llm/quality/counterexampleQueue');

test('phase766: counterexample classifier maps loop and retrieval signals to expected CE ids', () => {
  const loop = classifyCounterexampleSignal({ category: 'loop_case', signal: 'router_default_casual' });
  const retrieval = classifyCounterexampleSignal({ category: 'line_fit_failure', signal: 'bad_retrieval_quality' });
  assert.equal(loop.counterexampleId, 'CE-06');
  assert.equal(retrieval.counterexampleId, 'CE-08');
});

test('phase766: usage quality summary emits counterexample queue for quality board', () => {
  const summary = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 30,
      legacyTemplateHitRate: 0.15,
      defaultCasualRate: 0.4,
      contradictionRate: 0.03,
      avgSourceAuthorityScore: 0.8,
      avgSourceFreshnessScore: 0.74,
      conciseModeAppliedRate: 0.51,
      repetitionPreventedRate: 0.3,
      directAnswerAppliedRate: 0.3,
      clarifySuppressedRate: 0.35,
      avgContextCarryScore: 0.2,
      avgRepeatRiskScore: 0.7,
      followupQuestionIncludedRate: 0.4,
      domainIntentConciergeRate: 0.45,
      avgUnsupportedClaimCount: 0.2,
      officialOnlySatisfiedRate: 0.7,
      retrieveNeededRate: 0.6,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 12 }]
    },
    gateAuditBaseline: { acceptedRate: 0.6 },
    optimization: { compatShareWindow: 0.18 },
    releaseReadiness: { ready: false, metrics: { avgEvidenceCoverage: 0.62 } },
    byPlan: {
      free: { blockedRate: 0.4 },
      pro: { blockedRate: 0.35 }
    },
    actionRows: [
      {
        routerReason: 'default_casual',
        repetitionPrevented: false,
        domainIntent: 'school',
        conversationMode: 'casual',
        followupIntent: 'none',
        strategy: 'casual',
        contextCarryScore: 0.2,
        retrieveNeeded: true,
        retrievalQuality: 'bad',
        actionCount: 5,
        judgeDisagreement: 0.05
      }
    ],
    baselineOverallScore: 70
  });

  assert.equal(Array.isArray(summary.counterexampleQueue), true);
  assert.equal(summary.counterexampleQueue.length > 0, true);
  assert.equal(summary.counterexampleQueueOpenCount, summary.counterexampleQueue.length);
  assert.equal(summary.counterexampleQueue.some((row) => row.counterexampleId === 'CE-06'), true);
});

test('phase766: board queue builder deduplicates same signal mapping', () => {
  const queue = buildCounterexampleQueueFromBoards({
    topQualityFailures: [{ rank: 1, failure: 'slice_fail:short_followup' }],
    topLoopCases: [
      { signal: 'router_default_casual', count: 3 },
      { signal: 'router_default_casual', count: 2 }
    ],
    topContextLossCases: [],
    topJapaneseServiceFailures: [],
    topLineFitFailures: []
  });

  const ce06Rows = queue.filter((row) => row.counterexampleId === 'CE-06');
  assert.equal(ce06Rows.length, 1);
});
