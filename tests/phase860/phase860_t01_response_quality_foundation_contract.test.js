'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');
const {
  createResponseQualityContext,
  createResponseQualityVerdict
} = require('../../src/domain/llm/quality/responseQualityFoundation');

test('phase860: response quality context can drive readiness gate telemetry', () => {
  const responseQualityContext = createResponseQualityContext({
    entryType: 'faq',
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.91,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.88,
    cityPackContext: true,
    cityPackGrounded: true,
    cityPackAuthorityScore: 0.9,
    cityPackFreshnessScore: 0.9
  });

  const gate = runAnswerReadinessGateV2({
    responseQualityContext
  });

  assert.equal(responseQualityContext.contractVersion, 'response_quality_context_v1');
  assert.equal(gate.telemetry.responseQualityContextVersion, 'response_quality_context_v1');
  assert.equal(gate.telemetry.cityPackContext, true);
  assert.equal(gate.readiness.decision, 'allow');
});

test('phase860: response quality verdict preserves transform-shaped hedge output', () => {
  const responseQualityContext = createResponseQualityContext({
    entryType: 'webhook',
    requestShape: 'rewrite',
    outputForm: 'non_dogmatic',
    transformSource: 'prior_assistant',
    knowledgeScope: 'general'
  });

  const verdict = createResponseQualityVerdict({
    responseQualityContext,
    readinessOverride: {
      decision: 'hedged',
      reasonCodes: ['source_readiness_hedged'],
      safeResponseMode: 'answer_with_hedge'
    },
    replyText: '今は優先順位と期限を先に整理すると、進めやすそうです。'
  });

  assert.equal(verdict.contractVersion, 'response_quality_verdict_v1');
  assert.equal(verdict.enforced, true);
  assert.equal(verdict.replyText.includes('補足:'), false);
  assert.equal(verdict.replyText.includes('最終確認'), false);
  assert.equal(verdict.telemetry.responseQualityVerdictVersion, 'response_quality_verdict_v1');
});

test('phase860: response quality verdict preserves low-risk allow when readiness signals are absent', () => {
  const responseQualityContext = createResponseQualityContext({
    entryType: 'webhook',
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'low'
  });

  const verdict = createResponseQualityVerdict({
    responseQualityContext,
    allowWhenSignalsMissing: true,
    legalSnapshot: { legalDecision: 'allow' },
    riskSnapshot: { intentRiskTier: 'low' },
    replyText: '状況を整理しました。次の一手を進めましょう。'
  });

  assert.equal(verdict.readiness.decision, 'allow');
  assert.deepEqual(verdict.readiness.reasonCodes, ['readiness_signal_missing_allow']);
  assert.equal(verdict.replyText, '状況を整理しました。次の一手を進めましょう。');
});
