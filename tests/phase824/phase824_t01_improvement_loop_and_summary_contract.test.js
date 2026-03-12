'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { runImprovementLoop } = require('../../tools/run_llm_improvement_loop');
const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase824: improvement loop writes all four artifacts through the orchestration pipeline', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'member-llm-loop-v3-'));
  const result = await runImprovementLoop({
    rootDir: process.cwd(),
    outputDir
  }, {
    buildRepoScanReport: () => ({
      scanVersion: 'v3',
      generatedAt: '2026-03-12T00:00:00.000Z',
      baselineRef: 'test-ref',
      dimensions: {},
      topGaps: [],
      summary: { coverageScore: 1 }
    }),
    loadRuntimeAuditInputs: async () => ({
      gateAuditRows: [],
      actionRows: [],
      qualityRows: [],
      faqRows: []
    }),
    buildRuntimeAuditReport: () => ({
      auditVersion: 'v3',
      generatedAt: '2026-03-12T00:00:00.000Z',
      window: {},
      kpis: {},
      topFailures: [],
      missingMeasurements: [],
      releaseBlockers: []
    }),
    buildFailureClusters: () => ({
      clusterVersion: 'v3',
      generatedAt: '2026-03-12T00:00:00.000Z',
      clusters: [
        {
          category: 'telemetry',
          severity: 'medium',
          signals: [{ signal: 'traceJoinCompleteness' }]
        }
      ]
    }),
    buildPlanFromClusters: () => ({
      planVersion: 'v3',
      generatedAt: '2026-03-12T00:00:00.000Z',
      source: {},
      backlog: [
        {
          PR: 'PR-telemetry-visibility',
          objective: 'Close trace and summary gaps.',
          files: ['src/routes/admin/osLlmUsageSummary.js'],
          tests: ['tests/phase809/*.test.js'],
          risk: 'Low',
          rollback: 'Revert PR.'
        }
      ]
    })
  });

  [
    result.outputs.repoScanReport,
    result.outputs.qualityAuditReport,
    result.outputs.failureClusters,
    result.outputs.improvementPlan
  ].forEach((filePath) => {
    assert.equal(fs.existsSync(filePath), true, filePath);
  });
});

test('phase824: improvement loop degrades gracefully when runtime audit loading fails', async () => {
  const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'member-llm-loop-v3-degraded-'));
  const result = await runImprovementLoop({
    rootDir: process.cwd(),
    outputDir
  }, {
    buildRepoScanReport: () => ({
      scanVersion: 'v3',
      generatedAt: '2026-03-12T00:00:00.000Z',
      baselineRef: 'test-ref',
      dimensions: {},
      topGaps: [],
      summary: { coverageScore: 1 }
    }),
    loadRuntimeAuditInputs: async () => {
      throw Object.assign(new Error('reauth related error (invalid_rapt)'), { code: 'invalid_rapt' });
    }
  });

  assert.equal(result.qualityAuditReport.source.runtimeFetchStatus, 'unavailable');
  assert.ok(result.qualityAuditReport.releaseBlockers.includes('runtimeAuditUnavailable'));
  assert.equal(fs.existsSync(result.outputs.improvementPlan), true);
});

test('phase824: quality framework summary exposes add-only improvementLoop fields without regressing existing quality fields', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 12,
      legacyTemplateHitRate: 0,
      defaultCasualRate: 0.01,
      contradictionRate: 0,
      avgSourceAuthorityScore: 0.9,
      avgSourceFreshnessScore: 0.9,
      conciseModeAppliedRate: 0.84,
      repetitionPreventedRate: 0.82,
      directAnswerAppliedRate: 0.86,
      clarifySuppressedRate: 0.83,
      avgContextCarryScore: 0.8,
      avgRepeatRiskScore: 0.14,
      followupQuestionIncludedRate: 0.73,
      followupResolutionRate: 0.78,
      followupCarryFromHistoryRate: 0.8,
      contextualResumeHandledRate: 0.81,
      recoverySignalRate: 0.72,
      misunderstandingRecoveredRate: 0.76,
      recoveryHandledRate: 0.77,
      domainIntentConciergeRate: 0.83,
      avgUnsupportedClaimCount: 0.03,
      officialOnlySatisfiedRate: 0.96,
      retrieveNeededRate: 0.12,
      verificationOutcomes: []
    },
    gateAuditBaseline: { acceptedRate: 0.96, callsTotal: 12, blockedReasons: [], entryTypes: [], entryQualitySignals: [] },
    optimization: { compatShareWindow: 0.04 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { free: { blockedRate: 0.1 }, pro: { blockedRate: 0.02 } },
    actionRows: [
      {
        createdAt: '2026-03-12T10:00:00.000Z',
        answerReadinessVersion: 'v2',
        answerReadinessV2Stage: 'soft_enforcement',
        answerReadinessV2Mode: 'soft_enforced_v2',
        answerReadinessEnforcedV2: true,
        answerReadinessLogOnlyV2: false,
        readinessDecisionV2: 'clarify',
        cityPackGrounded: false,
        cityPackFreshnessScore: 0.4,
        cityPackAuthorityScore: 0.5,
        emergencyContextActive: true,
        emergencyOfficialSourceSatisfied: false,
        journeyPhase: 'phase_a',
        taskBlockerDetected: true,
        journeyAlignedAction: false,
        savedFaqReused: true,
        savedFaqReusePass: false,
        crossSystemConflictDetected: true,
        intentRiskTier: 'high',
        officialOnlySatisfied: false,
        contradictionDetected: true,
        unsupportedClaimCount: 1,
        fallbackType: 'knowledge_gap'
      }
    ],
    traceSearchAuditRows: [
      {
        createdAt: '2026-03-12T10:05:00.000Z',
        traceJoinCompleteness: 0.5,
        adminTraceResolutionTimeMs: 1200000
      }
    ],
    baselineOverallScore: 54.9
  });

  assert.equal(typeof quality.overallScore, 'number');
  assert.equal(quality.qualityLoopV2.version, 'v2-foundation');
  assert.ok(quality.qualityLoopV2.improvementLoop);
  assert.ok(['ok', 'warning', 'action_required', 'missing'].includes(quality.qualityLoopV2.improvementLoop.qualityLoopStatus));
  assert.ok(Array.isArray(quality.qualityLoopV2.improvementLoop.topFailures));
  assert.ok(Array.isArray(quality.qualityLoopV2.improvementLoop.improvementBacklog));
  assert.ok(quality.qualityLoopV2.improvementLoop.topFailures.length <= 5);
  assert.ok(quality.qualityLoopV2.improvementLoop.improvementBacklog.length <= 5);
});
