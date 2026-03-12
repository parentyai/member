'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function runNode(args, env) {
  return spawnSync('node', args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, env || {})
  });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, filePath), 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(path.join(ROOT, filePath)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, filePath), `${JSON.stringify(payload, null, 2)}\n`);
}

function buildQualityLoopV2(overrides) {
  const params = overrides && typeof overrides === 'object' ? overrides : {};
  const stage = typeof params.rolloutStage === 'string' ? params.rolloutStage : 'nogo_gate_mandatory';
  const criticalSlices = Array.isArray(params.criticalSlices)
    ? params.criticalSlices
    : [
        { sliceKey: 'emergency_high_risk', status: 'pass', blocked: false, sourceMetric: 'emergencyOfficialSourceRate' },
        { sliceKey: 'saved_faq_high_risk_reuse', status: 'pass', blocked: false, sourceMetric: 'savedFaqReusePassRate' },
        { sliceKey: 'journey_blocker_conflict', status: 'pass', blocked: false, sourceMetric: 'taskBlockerConflictRate' },
        { sliceKey: 'stale_city_pack_required_source', status: 'pass', blocked: false, sourceMetric: 'staleSourceBlockRate' },
        { sliceKey: 'compat_spike', status: 'pass', blocked: false, sourceMetric: 'compatShareWindow' },
        { sliceKey: 'trace_join_incomplete', status: 'pass', blocked: false, sourceMetric: 'traceJoinCompleteness' },
        { sliceKey: 'direct_url_leakage', status: 'pass', blocked: false, sourceMetric: 'directUrlLeakage' },
        { sliceKey: 'official_source_missing_on_high_risk', status: 'pass', blocked: false, sourceMetric: 'officialSourceUsageRateHighRisk' }
      ];

  return {
    version: 'v2-foundation',
    rolloutStage: stage,
    nogoGateMandatoryActive: stage === 'nogo_gate_mandatory',
    crossSystemPriorityOrder: [
      'Emergency',
      'Legal / Consent',
      'Task Blocker',
      'Journey State',
      'City Pack / Source Refs / Local Guidance',
      'Saved FAQ',
      'Generic LLM reasoning'
    ],
    criticalSliceKeys: criticalSlices.map((row) => row.sliceKey),
    criticalSlices,
    criticalSliceFailCount: criticalSlices.filter((row) => row.status !== 'pass').length,
    integrationKpis: {
      cityPackGroundingRate: { key: 'cityPackGroundingRate', status: 'pass', value: 0.94, sampleCount: 10 },
      staleSourceBlockRate: { key: 'staleSourceBlockRate', status: 'pass', value: 0.97, sampleCount: 10 },
      emergencyOfficialSourceRate: { key: 'emergencyOfficialSourceRate', status: 'pass', value: 1, sampleCount: 4 },
      emergencyOverrideAppliedRate: { key: 'emergencyOverrideAppliedRate', status: 'pass', value: 0.25, sampleCount: 4 },
      journeyAlignedActionRate: { key: 'journeyAlignedActionRate', status: 'pass', value: 0.9, sampleCount: 8 },
      taskBlockerConflictRate: { key: 'taskBlockerConflictRate', status: 'pass', value: 0.01, sampleCount: 8 },
      savedFaqReusePassRate: { key: 'savedFaqReusePassRate', status: 'pass', value: 0.95, sampleCount: 6 },
      crossSystemConflictRate: { key: 'crossSystemConflictRate', status: 'pass', value: 0.02, sampleCount: 10 },
      traceJoinCompleteness: { key: 'traceJoinCompleteness', status: 'pass', value: 1, sampleCount: 5 },
      adminTraceResolutionTime: { key: 'adminTraceResolutionTime', status: 'pass', value: 600000, sampleCount: 5 },
      officialSourceUsageRateHighRisk: { key: 'officialSourceUsageRateHighRisk', status: 'pass', value: 0.97, sampleCount: 5 },
      compatShareWindow: { key: 'compatShareWindow', status: 'pass', value: 0.04, sampleCount: 5 },
      directUrlLeakage: { key: 'directUrlLeakage', status: 'pass', value: 0, sampleCount: 5 }
    },
    readinessV2: {
      sampleCount: 5,
      versionObserved: 'v2',
      decisionBreakdown: [{ decision: 'allow', count: 5 }],
      modeBreakdown: [{ mode: 'hard_enforced_v2', count: 5 }],
      stageBreakdown: [{ stage, count: 5 }],
      hardEnforcedCount: 5,
      softEnforcedCount: 0,
      logOnlyCount: 0,
      nogoGateMandatoryCount: stage === 'nogo_gate_mandatory' ? 5 : 0
    },
    missingJoins: [],
    reservations: []
  };
}

function buildSummaryWithQualityLoopV2(overrides) {
  const payload = readJson('benchmarks/frozen/v1/runtime_summary_snapshot.v1.json');
  payload.runtimeSummarySource = 'runtime_summary_live';
  payload.summary = payload.summary || {};
  payload.summary.optimization = Object.assign({}, payload.summary.optimization, {
    compatShareWindow: 0.04
  });
  payload.summary.qualityFramework = Object.assign({}, payload.summary.qualityFramework, {
    qualityLoopV2: buildQualityLoopV2(overrides)
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

test('phase816: strict quality gate requires no-go mandatory rollout stage when enabled', () => {
  const summaryPath = 'tmp/phase816_gate_summary.json';
  writeJson(summaryPath, buildSummaryWithQualityLoopV2({ rolloutStage: 'hard_enforcement' }));

  const run = runNode([
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--summary', summaryPath,
    '--requireAllSlicesPass', 'true',
    '--requireRuntimeSummary', 'true',
    '--requireRuntimeProvenance', 'true',
    '--requireNoGoGateMandatory', 'true',
    '--output', 'tmp/phase816_gate_result.json'
  ]);

  assert.notEqual(run.status, 0, run.stderr || run.stdout);
  const payload = readJson('tmp/phase816_gate_result.json');
  assert.equal(payload.ok, false);
  assert.equal(payload.requireNoGoGateMandatory, true);
  assert.equal(payload.failures.includes('quality_loop_v2_rollout_stage_not_mandatory:hard_enforcement'), true);
});

test('phase816: strict release policy blocks v2 critical slice failures when no-go mandatory is required', () => {
  const { baselinePath, candidatePath, mustPassPath } = prepareArtifacts('phase816_release_fail');
  const summaryPath = 'tmp/phase816_release_fail_summary.json';
  writeJson(summaryPath, buildSummaryWithQualityLoopV2({
    criticalSlices: [
      { sliceKey: 'trace_join_incomplete', status: 'fail', blocked: true, sourceMetric: 'traceJoinCompleteness' }
    ]
  }));

  const run = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', baselinePath,
    '--candidate', candidatePath,
    '--mustPass', mustPassPath,
    '--summary', summaryPath,
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--requireNoGoGateMandatory', 'true',
    '--output', 'tmp/phase816_release_policy_fail.json'
  ]);

  assert.notEqual(run.status, 0, run.stderr || run.stdout);
  const payload = readJson('tmp/phase816_release_policy_fail.json');
  assert.equal(payload.ok, false);
  assert.equal(payload.failures.includes('quality_loop_v2_critical_slice_fail:trace_join_incomplete'), true);
});

test('phase816: strict release policy passes when no-go mandatory rollout stage and v2 critical slices are green', () => {
  const { baselinePath, candidatePath, mustPassPath } = prepareArtifacts('phase816_release_pass');
  const summaryPath = 'tmp/phase816_release_pass_summary.json';
  writeJson(summaryPath, buildSummaryWithQualityLoopV2());

  const run = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', baselinePath,
    '--candidate', candidatePath,
    '--mustPass', mustPassPath,
    '--summary', summaryPath,
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'false',
    '--requireNoGoGateMandatory', 'true',
    '--output', 'tmp/phase816_release_policy_pass.json'
  ]);

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = readJson('tmp/phase816_release_policy_pass.json');
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseGatePolicy.noGoGateMandatoryRequired, true);
  assert.equal(payload.qualityLoopV2.rolloutStage, 'nogo_gate_mandatory');
});
