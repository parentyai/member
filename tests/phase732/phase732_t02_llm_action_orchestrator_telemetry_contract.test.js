'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { buildConversationQualitySummary } = require('../../src/routes/admin/osLlmUsageSummary');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase732: conversation quality summary aggregates orchestrator telemetry fields', () => {
  const summary = buildConversationQualitySummary([
    {
      conversationNaturalnessVersion: 'v2',
      legacyTemplateHit: false,
      followupQuestionIncluded: true,
      pitfallIncluded: true,
      actionCount: 2,
      candidateCount: 2,
      retrieveNeeded: true,
      retrievalQuality: 'mixed',
      strategy: 'grounded_answer',
      verificationOutcome: 'clarify',
      judgeWinner: 'clarify_candidate',
      contradictionFlags: ['insufficient_evidence'],
      contradictionDetected: true,
      unsupportedClaimCount: 1,
      readinessDecision: 'clarify',
      readinessSafeResponseMode: 'clarify',
      domainIntent: 'general',
      conversationMode: 'casual',
      fallbackType: 'low_specificity_clarify'
      ,
      followupIntent: 'next_step',
      conciseModeApplied: false,
      repetitionPrevented: true,
      routerReason: 'default_casual'
    },
    {
      conversationNaturalnessVersion: 'v2',
      legacyTemplateHit: false,
      followupQuestionIncluded: false,
      pitfallIncluded: true,
      actionCount: 3,
      candidateCount: 2,
      retrieveNeeded: false,
      retrievalQuality: 'none',
      strategy: 'domain_concierge',
      verificationOutcome: 'passed',
      judgeWinner: 'domain_concierge_candidate',
      contradictionFlags: [],
      contradictionDetected: false,
      unsupportedClaimCount: 0,
      readinessDecision: 'allow',
      readinessSafeResponseMode: 'answer',
      domainIntent: 'housing',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge'
      ,
      followupIntent: 'docs_required',
      conciseModeApplied: true,
      repetitionPrevented: false,
      routerReason: 'contextual_domain_resume',
      parentIntentType: 'DOCUMENTS_REQUIRED',
      parentAnswerMode: 'ACTION_PLAN',
      parentLifecycleStage: 'ARRIVAL_0_30',
      parentChapter: 'N',
      parentRoutingInvariantStatus: 'ok',
      requiredCoreFactsComplete: false,
      missingRequiredCoreFactsCount: 6,
      requiredCoreFactsCriticalMissingCount: 2,
      requiredCoreFactsGateDecision: 'clarify'
    }
  ]);

  assert.equal(summary.sampleCount, 2);
  assert.equal(summary.conversationNaturalnessVersion, 'v2');
  assert.equal(summary.avgCandidateCount, 2);
  assert.equal(summary.retrieveNeededRate, 0.5);
  assert.equal(summary.contradictionRate, 0.5);
  const strategyCounts = Object.fromEntries(summary.strategies.map((row) => [row.strategy, row.count]));
  assert.equal(strategyCounts.domain_concierge, 1);
  assert.equal(strategyCounts.grounded_answer, 1);
  assert.ok(Array.isArray(summary.retrievalQualities));
  assert.ok(Array.isArray(summary.verificationOutcomes));
  assert.ok(Array.isArray(summary.judgeWinners));
  assert.ok(Array.isArray(summary.readinessDecisions));
  assert.ok(Array.isArray(summary.readinessSafeResponseModes));
  assert.equal(summary.contradictionDetectedRate, 0.5);
  assert.equal(summary.avgUnsupportedClaimCount, 0.5);
  assert.equal(summary.conciseModeAppliedRate, 0.5);
  assert.equal(summary.repetitionPreventedRate, 0.5);
  assert.equal(summary.defaultCasualRate, 0.5);
  assert.ok(Array.isArray(summary.followupIntents));
  assert.ok(Array.isArray(summary.routerReasons));
  assert.ok(Array.isArray(summary.parentIntentTypes));
  assert.ok(Array.isArray(summary.parentAnswerModes));
  assert.ok(Array.isArray(summary.parentLifecycleStages));
  assert.ok(Array.isArray(summary.parentChapters));
  assert.ok(Array.isArray(summary.parentRoutingInvariantStatuses));
  assert.ok(Array.isArray(summary.requiredCoreFactsGateDecisions));
  assert.ok(Array.isArray(summary.contradictionFlags));
  assert.equal(typeof summary.requiredCoreFactsCompleteRate, 'number');
  assert.equal(typeof summary.avgMissingRequiredCoreFactsCount, 'number');
  assert.equal(typeof summary.avgRequiredCoreFactsCriticalMissingCount, 'number');
});

test('phase732: llm action log schema includes orchestrator telemetry fields', () => {
  const repo = read('src/repos/firestore/llmActionLogsRepo.js');
  [
    'strategy',
    'retrieveNeeded',
    'retrievalQuality',
    'judgeWinner',
    'judgeScores',
    'verificationOutcome',
    'contradictionFlags',
    'candidateCount',
    'readinessDecision',
    'readinessReasonCodes',
    'readinessSafeResponseMode',
    'unsupportedClaimCount',
    'contradictionDetected',
    'answerReadinessLogOnly',
    'orchestratorPathUsed',
    'contextResumeDomain',
    'loopBreakApplied',
    'followupIntent',
    'actionClass',
    'actionGatewayEnabled',
    'actionGatewayEnforced',
    'actionGatewayAllowed',
    'actionGatewayDecision',
    'actionGatewayReason',
    'parentIntentType',
    'parentAnswerMode',
    'parentLifecycleStage',
    'parentChapter',
    'parentRoutingInvariantStatus',
    'parentRoutingInvariantErrors',
    'requiredCoreFactsComplete',
    'missingRequiredCoreFacts',
    'missingRequiredCoreFactsCount',
    'requiredCoreFactsCriticalMissingCount',
    'requiredCoreFactsGateDecision',
    'requiredCoreFactsGateLogOnly',
    'conciseModeApplied',
    'repetitionPrevented',
    'intentRiskTier',
    'riskReasonCodes',
    'committedNextActions',
    'committedFollowupQuestion'
  ].forEach((token) => {
    assert.ok(repo.includes(token), token);
  });
});
