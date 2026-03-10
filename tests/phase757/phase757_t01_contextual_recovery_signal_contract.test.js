'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildConversationQualitySummary,
  buildQualityFrameworkSummary
} = require('../../src/routes/admin/osLlmUsageSummary');

test('phase757: conversation quality summary captures follow-up resolution and contextual recovery signals', () => {
  const summary = buildConversationQualitySummary([
    {
      entryType: 'webhook',
      conversationMode: 'concierge',
      routerReason: 'contextual_domain_resume',
      contextResumeDomain: 'school',
      followupIntent: 'docs_required',
      directAnswerApplied: true,
      clarifySuppressed: true,
      repetitionPrevented: true,
      contextCarryScore: 0.81,
      repeatRiskScore: 0.66
    },
    {
      entryType: 'webhook',
      conversationMode: 'concierge',
      routerReason: 'contextual_domain_resume',
      contextResumeDomain: 'school',
      followupIntent: 'next_step',
      directAnswerApplied: true,
      clarifySuppressed: true,
      repetitionPrevented: true,
      contextCarryScore: 0.78,
      repeatRiskScore: 0.71
    }
  ]);

  assert.equal(summary.followupResolutionRate, 1);
  assert.equal(summary.contextualResumeHandledRate, 1);
  assert.equal(summary.recoveryHandledRate, 1);
});

test('phase757: quality framework lifts continuity/recovery dimensions when contextual recovery signals are strong', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 120,
      legacyTemplateHitRate: 0,
      defaultCasualRate: 0.03,
      contradictionRate: 0.01,
      avgSourceAuthorityScore: 0.91,
      avgSourceFreshnessScore: 0.89,
      conciseModeAppliedRate: 0.88,
      repetitionPreventedRate: 0.9,
      directAnswerAppliedRate: 0.9,
      clarifySuppressedRate: 0.86,
      avgContextCarryScore: 0.85,
      avgRepeatRiskScore: 0.2,
      followupQuestionIncludedRate: 0.74,
      followupResolutionRate: 0.92,
      contextualResumeHandledRate: 0.9,
      recoveryHandledRate: 0.88,
      domainIntentConciergeRate: 0.9,
      avgUnsupportedClaimCount: 0.01,
      officialOnlySatisfiedRate: 0.91,
      retrieveNeededRate: 0.18,
      verificationOutcomes: [{ verificationOutcome: 'clarify', count: 14 }]
    },
    gateAuditBaseline: { acceptedRate: 0.94 },
    optimization: { compatShareWindow: 0.07 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { free: { blockedRate: 0.08 }, pro: { blockedRate: 0.04 } },
    actionRows: [],
    baselineOverallScore: 90
  });

  const byKey = (key) => (quality.dimensions || []).find((row) => row && row.key === key) || null;
  assert.equal(byKey('conversation_continuity').score >= 0.85, true);
  assert.equal(byKey('misunderstanding_recovery').score >= 0.85, true);
  assert.equal(byKey('clarification_quality').score >= 0.8, true);
  assert.equal(byKey('empathy').score >= 0.8, true);
  assert.equal(byKey('latency_surface_efficiency').score >= 0.8, true);
});

