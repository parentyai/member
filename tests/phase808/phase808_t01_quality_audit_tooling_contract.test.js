'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const TMP_DIR = path.join(ROOT, 'tmp');
const {
  buildQualityFrameworkSummary
} = require('../../src/routes/admin/osLlmUsageSummary');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test('phase808: v2 quality audit tooling emits audit, integration audit, and improvement plan artifacts', () => {
  const summary = {
    summary: {
      releaseReadiness: { ready: true },
      qualityFramework: buildQualityFrameworkSummary({
        conversationQuality: {
          sampleCount: 12,
          legacyTemplateHitRate: 0,
          defaultCasualRate: 0.01,
          contradictionRate: 0,
          avgSourceAuthorityScore: 0.92,
          avgSourceFreshnessScore: 0.9,
          conciseModeAppliedRate: 0.88,
          repetitionPreventedRate: 0.87,
          directAnswerAppliedRate: 0.9,
          clarifySuppressedRate: 0.84,
          avgContextCarryScore: 0.85,
          avgRepeatRiskScore: 0.12,
          followupQuestionIncludedRate: 0.78,
          followupResolutionRate: 0.8,
          followupCarryFromHistoryRate: 0.81,
          contextualResumeHandledRate: 0.82,
          recoverySignalRate: 0.76,
          misunderstandingRecoveredRate: 0.77,
          recoveryHandledRate: 0.79,
          domainIntentConciergeRate: 0.83,
          avgUnsupportedClaimCount: 0.02,
          officialOnlySatisfiedRate: 0.97,
          retrieveNeededRate: 0.12,
          verificationOutcomes: []
        },
        gateAuditBaseline: { acceptedRate: 0.96 },
        optimization: { compatShareWindow: 0.04 },
        releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.92 } },
        byPlan: {
          free: { blockedRate: 0.1 },
          pro: { blockedRate: 0.03 }
        },
        actionRows: [
          {
            intentRiskTier: 'high',
            officialOnlySatisfied: true,
            answerReadinessVersion: 'v2',
            readinessDecisionV2: 'allow',
            cityPackGrounded: true,
            cityPackFreshnessScore: 0.92,
            cityPackAuthorityScore: 0.93,
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
      })
    }
  };
  const report = {
    overall_quality_score: 92.5,
    hard_gate_failures: [],
    top_10_quality_failures: [],
    top_10_loop_cases: [],
    top_10_context_loss_cases: [],
    top_10_japanese_service_failures: [],
    top_10_line_fit_failures: []
  };
  const gate = {
    gate: {
      failures: []
    }
  };

  const summaryPath = path.join(TMP_DIR, 'phase808_usage_summary.json');
  const reportPath = path.join(TMP_DIR, 'phase808_quality_report.json');
  const gatePath = path.join(TMP_DIR, 'phase808_quality_gate.json');
  const auditPath = path.join(TMP_DIR, 'phase808_quality_audit.json');
  const integrationPath = path.join(TMP_DIR, 'phase808_integration_audit.json');
  const planPath = path.join(TMP_DIR, 'phase808_improvement_plan.json');
  writeJson(summaryPath, summary);
  writeJson(reportPath, report);
  writeJson(gatePath, gate);

  const auditRun = spawnSync('node', [
    'tools/run_llm_quality_audit.js',
    '--summary', path.relative(ROOT, summaryPath),
    '--report', path.relative(ROOT, reportPath),
    '--gate', path.relative(ROOT, gatePath),
    '--output', path.relative(ROOT, auditPath)
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(auditRun.status, 0, auditRun.stderr || auditRun.stdout);

  const integrationRun = spawnSync('node', [
    'tools/run_llm_integration_audit.js',
    '--summary', path.relative(ROOT, summaryPath),
    '--output', path.relative(ROOT, integrationPath)
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(integrationRun.status, 0, integrationRun.stderr || integrationRun.stdout);

  const planRun = spawnSync('node', [
    'tools/generate_llm_improvement_plan.js',
    '--audit', path.relative(ROOT, auditPath),
    '--integration', path.relative(ROOT, integrationPath),
    '--output', path.relative(ROOT, planPath)
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(planRun.status, 0, planRun.stderr || planRun.stdout);

  const auditPayload = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
  const integrationPayload = JSON.parse(fs.readFileSync(integrationPath, 'utf8'));
  const planPayload = JSON.parse(fs.readFileSync(planPath, 'utf8'));

  assert.equal(auditPayload.auditVersion, 'v2');
  assert.equal(typeof auditPayload.overallScore, 'number');
  assert.ok(Array.isArray(auditPayload.nextAuditFocus));
  assert.ok(integrationPayload.integrationKpis.cityPackGroundingRate);
  assert.ok(Array.isArray(integrationPayload.criticalSlices));
  assert.ok(Array.isArray(planPayload.backlog));
});
