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
      domainIntent: 'general',
      conversationMode: 'casual',
      fallbackType: 'low_specificity_clarify'
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
      domainIntent: 'housing',
      conversationMode: 'concierge',
      fallbackType: 'domain_concierge'
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
  assert.ok(Array.isArray(summary.contradictionFlags));
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
    'committedNextActions',
    'committedFollowupQuestion'
  ].forEach((token) => {
    assert.ok(repo.includes(token), token);
  });
});
