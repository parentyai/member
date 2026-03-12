'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase809: usage summary exposes quality loop v2 integration KPIs and critical slices', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 10,
      legacyTemplateHitRate: 0,
      defaultCasualRate: 0.01,
      contradictionRate: 0,
      avgSourceAuthorityScore: 0.9,
      avgSourceFreshnessScore: 0.88,
      conciseModeAppliedRate: 0.85,
      repetitionPreventedRate: 0.82,
      directAnswerAppliedRate: 0.87,
      clarifySuppressedRate: 0.83,
      avgContextCarryScore: 0.81,
      avgRepeatRiskScore: 0.15,
      followupQuestionIncludedRate: 0.74,
      followupResolutionRate: 0.79,
      followupCarryFromHistoryRate: 0.8,
      contextualResumeHandledRate: 0.82,
      recoverySignalRate: 0.71,
      misunderstandingRecoveredRate: 0.75,
      recoveryHandledRate: 0.77,
      domainIntentConciergeRate: 0.84,
      avgUnsupportedClaimCount: 0.04,
      officialOnlySatisfiedRate: 0.96,
      retrieveNeededRate: 0.14,
      verificationOutcomes: []
    },
    gateAuditBaseline: { acceptedRate: 0.95 },
    optimization: { compatShareWindow: 0.04 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.91 } },
    byPlan: {
      free: { blockedRate: 0.12 },
      pro: { blockedRate: 0.02 }
    },
    actionRows: [
      {
        intentRiskTier: 'high',
        officialOnlySatisfied: true,
        answerReadinessVersion: 'v2',
        readinessDecisionV2: 'allow',
        cityPackGrounded: true,
        cityPackFreshnessScore: 0.92,
        cityPackAuthorityScore: 0.94,
        emergencyContextActive: true,
        emergencyOfficialSourceSatisfied: true,
        journeyPhase: 'phase_a',
        taskBlockerDetected: true,
        journeyAlignedAction: false,
        savedFaqReused: true,
        savedFaqReusePass: false,
        crossSystemConflictDetected: true
      }
    ],
    baselineOverallScore: 54.9
  });

  assert.equal(quality.qualityLoopV2.version, 'v2-foundation');
  assert.ok(quality.qualityLoopV2.integrationKpis.cityPackGroundingRate);
  assert.ok(quality.qualityLoopV2.integrationKpis.emergencyOfficialSourceRate);
  assert.ok(quality.qualityLoopV2.integrationKpis.journeyAlignedActionRate);
  assert.ok(Array.isArray(quality.qualityLoopV2.criticalSlices));
  assert.ok(quality.qualityLoopV2.criticalSlices.some((row) => row.sliceKey === 'journey_blocker_conflict'));
});

test('phase809: admin llm pane includes v2 integration sections and renderer hooks', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');

  [
    'llm-quality-v2-overview',
    'llm-quality-v2-readiness',
    'llm-quality-v2-integration',
    'llm-quality-v2-critical-slices'
  ].forEach((id) => {
    assert.match(html, new RegExp(`id=\\"${id}\\"`));
  });

  assert.match(appJs, /llm-quality-v2-overview/);
  assert.match(appJs, /llm-quality-v2-readiness/);
  assert.match(appJs, /llm-quality-v2-integration/);
  assert.match(appJs, /llm-quality-v2-critical-slices/);
});
