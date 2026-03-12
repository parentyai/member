'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

const {
  runRuntimeAudit,
  buildRuntimeAuditReport,
  buildUnavailableAuditReport
} = require('../../tools/run_llm_runtime_audit');
const { buildPlanFromClusters } = require('../../tools/generate_llm_improvement_plan');
const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

function gateRow(overrides) {
  return {
    createdAt: '2026-03-12T10:00:00.000Z',
    payloadSummary: Object.assign({
      decision: 'allow',
      entryType: 'webhook',
      assistantQuality: { evidenceCoverage: 0.9 }
    }, overrides || {})
  };
}

function actionRow(overrides) {
  return Object.assign({
    createdAt: '2026-03-12T10:01:00.000Z',
    intentRiskTier: 'high',
    officialOnlySatisfied: true,
    contradictionDetected: false,
    unsupportedClaimCount: 0,
    readinessDecisionV2: 'allow',
    fallbackType: 'none',
    cityPackGrounded: true,
    cityPackFreshnessScore: 0.92,
    cityPackAuthorityScore: 0.94,
    emergencyContextActive: true,
    emergencyOfficialSourceSatisfied: true,
    journeyPhase: 'phase_a',
    taskBlockerDetected: false,
    journeyAlignedAction: true,
    savedFaqReused: true,
    savedFaqReusePass: true
  }, overrides || {});
}

function writeJson(filePath, payload) {
  const target = path.join(ROOT, filePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(payload, null, 2)}\n`);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf8'));
}

function runNode(args, env) {
  return spawnSync('node', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {})
  });
}

function buildSummaryWithRuntimeAuditUnavailable() {
  const payload = readJson('benchmarks/frozen/v1/runtime_summary_snapshot.v1.json');
  payload.runtimeSummarySource = 'seeded_from_frozen_runtime_snapshot';
  payload.summary = payload.summary || {};
  payload.summary.optimization = Object.assign({}, payload.summary.optimization, {
    compatShareWindow: 0.04
  });
  payload.summary.qualityFramework = Object.assign({}, payload.summary.qualityFramework, {
    qualityLoopV2: {
      version: 'v2-foundation',
      rolloutStage: 'nogo_gate_mandatory',
      nogoGateMandatoryActive: true,
      crossSystemPriorityOrder: [
        'Emergency',
        'Legal / Consent',
        'Task Blocker',
        'Journey State',
        'City Pack / Source Refs / Local Guidance',
        'Saved FAQ',
        'Generic LLM reasoning'
      ],
      criticalSliceKeys: [
        'emergency_high_risk',
        'saved_faq_high_risk_reuse',
        'journey_blocker_conflict',
        'stale_city_pack_required_source',
        'compat_spike',
        'trace_join_incomplete',
        'direct_url_leakage',
        'official_source_missing_on_high_risk'
      ],
      criticalSlices: [
        { sliceKey: 'emergency_high_risk', status: 'pass', blocked: false, sourceMetric: 'emergencyOfficialSourceRate' }
      ],
      criticalSliceFailCount: 0,
      integrationKpis: {
        officialSourceUsageRateHighRisk: { key: 'officialSourceUsageRateHighRisk', status: 'pass', value: 0.97, sampleCount: 4 },
        compatShareWindow: { key: 'compatShareWindow', status: 'pass', value: 0.04, sampleCount: 4 },
        directUrlLeakage: { key: 'directUrlLeakage', status: 'pass', value: 0, sampleCount: 4 }
      },
      readinessV2: {
        sampleCount: 4,
        versionObserved: 'v2',
        decisionBreakdown: [{ decision: 'allow', count: 4 }],
        modeBreakdown: [{ mode: 'hard_enforced_v2', count: 4 }],
        stageBreakdown: [{ stage: 'nogo_gate_mandatory', count: 4 }],
        hardEnforcedCount: 4,
        softEnforcedCount: 0,
        logOnlyCount: 0,
        nogoGateMandatoryCount: 4
      },
      missingJoins: [],
      reservations: [],
      runtimeAudit: {
        status: 'action_required',
        runtimeAuditUnavailable: true,
        runtimeFetchStatus: 'unavailable',
        runtimeFetchErrorCode: 'invalid_rapt',
        runtimeFetchErrorMessage: 'Reauthentication required',
        recoveryActionCode: 'ADC_REAUTH_REQUIRED',
        recoveryCommands: ['gcloud auth application-default login']
      },
      improvementLoop: {
        qualityLoopStatus: 'action_required',
        lastAuditAt: '2026-03-12T10:10:00.000Z',
        runtimeAuditUnavailable: true,
        runtimeAuditStatus: 'action_required',
        runtimeFetchStatus: 'unavailable',
        runtimeFetchErrorCode: 'invalid_rapt',
        recoveryActionCode: 'ADC_REAUTH_REQUIRED',
        recoveryCommands: ['gcloud auth application-default login'],
        topFailures: [{ signal: 'runtimeAuditUnavailable' }],
        improvementBacklog: [{ PR: 'PR-telemetry-live-audit-restoration' }]
      }
    }
  });
  return payload;
}

function prepareArtifacts(prefix) {
  const baselinePath = `tmp/${prefix}_baseline_scorecard.json`;
  const candidatePath = `tmp/${prefix}_candidate_scorecard.json`;
  const mustPassPath = `tmp/${prefix}_must_pass.json`;

  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', baselinePath
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', candidatePath
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', mustPassPath
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  return { baselinePath, candidatePath, mustPassPath };
}

test('phase825: runtime audit exposes auth success path without degrading', async () => {
  const report = await runRuntimeAudit({
    fromAt: '2026-03-12T00:00:00.000Z',
    toAt: '2026-03-12T23:59:59.000Z',
    limit: 10
  }, {
    resolveRuntimeAuditAuth: async () => ({
      ok: true,
      authMode: 'service_account_key',
      authPathMap: {
        projectId: 'member-485303',
        credentialType: 'service_account'
      }
    }),
    loadRuntimeAuditInputs: async () => ({
      gateAuditRows: [gateRow()],
      actionRows: [actionRow()],
      qualityRows: [],
      faqRows: []
    }),
    buildRuntimeAuditReport,
    buildUnavailableAuditReport
  });

  assert.equal(report.source.runtimeFetchStatus, 'ok');
  assert.equal(report.source.runtimeAuditUnavailable, false);
  assert.equal(report.source.authMode, 'service_account_key');
  assert.equal(report.source.authPathMap.projectId, 'member-485303');
});

test('phase825: runtime audit keeps degraded mode structured on auth failure', async () => {
  const report = await runRuntimeAudit({
    fromAt: '2026-03-12T00:00:00.000Z',
    toAt: '2026-03-12T23:59:59.000Z',
    limit: 10
  }, {
    resolveRuntimeAuditAuth: async () => ({
      ok: false,
      runtimeFetchErrorCode: 'invalid_rapt',
      runtimeFetchErrorMessage: 'Reauthentication required',
      recoveryActionCode: 'ADC_REAUTH_REQUIRED',
      recoveryCommands: ['gcloud auth application-default login'],
      authMode: 'adc_user',
      authPathMap: {
        projectId: 'member-485303',
        credentialType: 'authorized_user'
      }
    }),
    buildUnavailableAuditReport
  });

  assert.equal(report.source.runtimeFetchStatus, 'unavailable');
  assert.equal(report.source.runtimeAuditUnavailable, true);
  assert.equal(report.source.runtimeFetchErrorCode, 'invalid_rapt');
  assert.equal(report.source.recoveryActionCode, 'ADC_REAUTH_REQUIRED');
  assert.ok(report.releaseBlockers.includes('runtimeAuditUnavailable'));
});

test('phase825: quality framework summary surfaces runtime audit unavailable in improvement loop', () => {
  const quality = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 1,
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
    gateAuditBaseline: { acceptedRate: 0.96, entryTypes: [], entryQualitySignals: [] },
    optimization: { compatShareWindow: 0.04 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { free: { blockedRate: 0.1 }, pro: { blockedRate: 0.02 } },
    actionRows: [actionRow()],
    traceSearchAuditRows: [],
    runtimeAudit: {
      runtimeAuditUnavailable: true,
      runtimeFetchStatus: 'unavailable',
      runtimeFetchErrorCode: 'invalid_rapt',
      recoveryActionCode: 'ADC_REAUTH_REQUIRED',
      recoveryCommands: ['gcloud auth application-default login']
    },
    baselineOverallScore: 54.9
  });

  assert.equal(quality.qualityLoopV2.runtimeAudit.runtimeAuditUnavailable, true);
  assert.equal(quality.qualityLoopV2.improvementLoop.runtimeAuditUnavailable, true);
  assert.equal(quality.qualityLoopV2.improvementLoop.qualityLoopStatus, 'action_required');
  assert.equal(quality.qualityLoopV2.improvementLoop.topFailures[0].signal, 'runtimeAuditUnavailable');
  assert.equal(quality.qualityLoopV2.improvementLoop.improvementBacklog[0].PR, 'PR-telemetry-live-audit-restoration');
});

test('phase825: planner surfaces telemetry live audit restoration first when runtime audit is unavailable', () => {
  const plan = buildPlanFromClusters({
    clusters: [
      {
        category: 'telemetry',
        severity: 'high',
        signals: [{ signal: 'runtimeAuditUnavailable' }]
      },
      {
        category: 'knowledge',
        severity: 'high',
        signals: [{ signal: 'cityPackGroundingRate' }]
      }
    ]
  }, { clustersPath: 'tmp/failure_clusters.json' });

  assert.equal(plan.backlog[0].PR, 'PR-telemetry-live-audit-restoration');
});

test('phase825: live runtime audit unavailable blocks quality gate and release policy when required', () => {
  const summaryPath = 'tmp/phase825_runtime_audit_unavailable_summary.json';
  writeJson(summaryPath, buildSummaryWithRuntimeAuditUnavailable());
  const { baselinePath, candidatePath, mustPassPath } = prepareArtifacts('phase825_runtime_audit');

  const gateRun = runNode([
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--summary', summaryPath,
    '--requireRuntimeSummary', 'true',
    '--requireRuntimeProvenance', 'true',
    '--requireLiveRuntimeAudit', 'true',
    '--output', 'tmp/phase825_gate_result.json'
  ]);
  assert.notEqual(gateRun.status, 0, gateRun.stderr || gateRun.stdout);
  const gatePayload = readJson('tmp/phase825_gate_result.json');
  assert.equal(gatePayload.failures.includes('runtime_audit_unavailable'), true);

  const releaseRun = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', baselinePath,
    '--candidate', candidatePath,
    '--mustPass', mustPassPath,
    '--summary', summaryPath,
    '--requireLiveRuntimeAudit', 'true',
    '--output', 'tmp/phase825_release_policy_result.json'
  ]);
  assert.notEqual(releaseRun.status, 0, releaseRun.stderr || releaseRun.stdout);
  const releasePayload = readJson('tmp/phase825_release_policy_result.json');
  assert.equal(releasePayload.failures.includes('runtime_audit_unavailable'), true);
});

test('phase825: admin UI and runbooks expose runtime audit recovery guidance', () => {
  const html = fs.readFileSync(path.join(ROOT, 'apps/admin/app.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(ROOT, 'apps/admin/assets/admin_app.js'), 'utf8');
  const llmRunbook = fs.readFileSync(path.join(ROOT, 'docs/LLM_RUNBOOK.md'), 'utf8');
  const loopDoc = fs.readFileSync(path.join(ROOT, 'docs/LLM_QUALITY_LOOP_V2.md'), 'utf8');
  const adminOps = fs.readFileSync(path.join(ROOT, 'docs/RUNBOOK_ADMIN_OPS.md'), 'utf8');

  assert.match(html, /llm-quality-v3-improvement-loop/);
  assert.match(appJs, /llm-quality-v3-improvement-loop/);
  assert.match(llmRunbook, /runtimeAuditUnavailable/);
  assert.match(llmRunbook, /gcloud auth application-default login/);
  assert.match(loopDoc, /provisional verdict/i);
  assert.match(adminOps, /quota_project|quota project/i);
  assert.match(adminOps, /impersonation/i);
});
