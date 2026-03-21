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

test('phase756: strict release policy blocks strict runtime signal regressions even with slices passing', () => {
  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase756_baseline_scorecard.json'
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_candidate_scorecard.json'
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_must_pass.json'
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const summaryPath = path.join(ROOT, 'tmp', 'phase756_summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    summary: {
      conversationQuality: {
        legacyTemplateHitRate: 0.003,
        defaultCasualRate: 0.12,
        followupQuestionIncludedRate: 0.1,
        conciseModeAppliedRate: 0.08,
        retrieveNeededRate: 0.2,
        avgActionCount: 2.6,
        directAnswerAppliedRate: 0.85,
        avgRepeatRiskScore: 0.62,
        formatComplianceRate: 0.99,
        detailCarryRate: 0.97,
        correctionRecoveryRate: 0.96,
        mixedDomainRetentionRate: 0.95,
        followupOveraskRate: 0.01,
        internalLabelLeakRate: 0,
        parrotEchoRate: 0,
        commandBoundaryCollisionRate: 0,
        domainIntentConciergeRate: 0.92,
        officialOnlySatisfiedRate: 0.94,
        followupResolutionRate: 0.89,
        contextualResumeHandledRate: 0.88,
        avgUnsupportedClaimCount: 0.01
      }
    }
  }, null, 2)}\n`);

  const strict = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase756_baseline_scorecard.json',
    '--candidate', 'tmp/phase756_candidate_scorecard.json',
    '--mustPass', 'tmp/phase756_must_pass.json',
    '--summary', 'tmp/phase756_summary.json',
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--output', 'tmp/phase756_release_policy_strict.json'
  ]);
  assert.notEqual(strict.status, 0);
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase756_release_policy_strict.json'), 'utf8'));
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes('runtime_signal_default_casual_rate_too_high'), true);
  assert.equal(result.failures.includes('runtime_signal_repeat_risk_too_high'), true);
  assert.equal(result.failures.some((item) => String(item).startsWith('slice_failed_or_not_improved:')), false);
});

test('phase756: strict release policy fails when extended runtime conversation signals are missing', () => {
  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase756_baseline_scorecard_missing_signals.json'
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_candidate_scorecard_missing_signals.json'
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_must_pass_missing_signals.json'
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const summaryPath = path.join(ROOT, 'tmp', 'phase756_missing_runtime_signals_summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    summary: {
      conversationQuality: {
        defaultCasualRate: 0.01,
        directAnswerAppliedRate: 0.95,
        avgRepeatRiskScore: 0.1
      }
    }
  }, null, 2)}\n`);

  const strict = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase756_baseline_scorecard_missing_signals.json',
    '--candidate', 'tmp/phase756_candidate_scorecard_missing_signals.json',
    '--mustPass', 'tmp/phase756_must_pass_missing_signals.json',
    '--summary', 'tmp/phase756_missing_runtime_signals_summary.json',
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--output', 'tmp/phase756_release_policy_missing_signals.json'
  ]);
  assert.notEqual(strict.status, 0);
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase756_release_policy_missing_signals.json'), 'utf8'));
  assert.equal(result.ok, false);
  assert.equal(result.failures.some((item) => String(item).startsWith('runtime_signal_missing:')), true);
  assert.equal(result.runtimeSignalCoverage.requiredKeys.includes('legacyTemplateHitRate'), true);
  assert.equal(result.runtimeSignalCoverage.requiredKeys.includes('retrieveNeededRate'), true);
  assert.equal(result.runtimeSignalCoverage.requiredKeys.includes('avgActionCount'), true);
  assert.equal(result.runtimeSignalCoverage.requiredKeys.includes('formatComplianceRate'), true);
  assert.equal(result.runtimeSignalCoverage.requiredKeys.includes('internalLabelLeakRate'), true);
});

test('phase756: strict release policy blocks concierge runtime regressions for format and label leaks', () => {
  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase756_baseline_scorecard_concierge_runtime.json'
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_candidate_scorecard_concierge_runtime.json'
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_must_pass_concierge_runtime.json'
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const summaryPath = path.join(ROOT, 'tmp', 'phase756_concierge_runtime_summary.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    summary: {
      conversationQuality: {
        legacyTemplateHitRate: 0.003,
        defaultCasualRate: 0.01,
        followupQuestionIncludedRate: 0.1,
        conciseModeAppliedRate: 0.08,
        retrieveNeededRate: 0.2,
        avgActionCount: 2.1,
        directAnswerAppliedRate: 0.94,
        avgRepeatRiskScore: 0.09,
        formatComplianceRate: 0.9,
        detailCarryRate: 0.97,
        correctionRecoveryRate: 0.96,
        mixedDomainRetentionRate: 0.95,
        followupOveraskRate: 0.01,
        internalLabelLeakRate: 0.02,
        parrotEchoRate: 0,
        commandBoundaryCollisionRate: 0,
        domainIntentConciergeRate: 0.92,
        officialOnlySatisfiedRate: 0.94,
        followupResolutionRate: 0.89,
        contextualResumeHandledRate: 0.88,
        avgUnsupportedClaimCount: 0.01
      }
    }
  }, null, 2)}\n`);

  const strict = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase756_baseline_scorecard_concierge_runtime.json',
    '--candidate', 'tmp/phase756_candidate_scorecard_concierge_runtime.json',
    '--mustPass', 'tmp/phase756_must_pass_concierge_runtime.json',
    '--summary', 'tmp/phase756_concierge_runtime_summary.json',
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--output', 'tmp/phase756_release_policy_concierge_runtime.json'
  ]);
  assert.notEqual(strict.status, 0);
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase756_release_policy_concierge_runtime.json'), 'utf8'));
  assert.equal(result.ok, false);
  assert.equal(result.failures.includes('concierge_runtime_signal_too_low:formatComplianceRate'), true);
  assert.equal(result.failures.includes('concierge_runtime_signal_too_high:internalLabelLeakRate'), true);
});

test('phase756: strict release policy enforces compat governance threshold', () => {
  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase756_baseline_scorecard_compat_governance.json'
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_candidate_scorecard_compat_governance.json'
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_must_pass_compat_governance.json'
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const summarySeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/frozen/v1/runtime_summary_snapshot.v1.json'), 'utf8'));
  summarySeed.summary = summarySeed.summary || {};
  summarySeed.summary.optimization = Object.assign({}, summarySeed.summary.optimization, {
    compatShareWindow: 0.21
  });
  summarySeed.runtimeSummarySource = 'seeded_from_frozen_runtime_snapshot';
  fs.writeFileSync(
    path.join(ROOT, 'tmp', 'phase756_summary_compat_governance.json'),
    `${JSON.stringify(summarySeed, null, 2)}\n`
  );

  const strict = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase756_baseline_scorecard_compat_governance.json',
    '--candidate', 'tmp/phase756_candidate_scorecard_compat_governance.json',
    '--mustPass', 'tmp/phase756_must_pass_compat_governance.json',
    '--summary', 'tmp/phase756_summary_compat_governance.json',
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--requireCompatGovernance', 'true',
    '--maxCompatShare', '0.15',
    '--output', 'tmp/phase756_release_policy_compat_governance.json'
  ]);
  assert.notEqual(strict.status, 0, strict.stderr || strict.stdout);
  const result = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tmp', 'phase756_release_policy_compat_governance.json'), 'utf8')
  );
  assert.equal(result.ok, false);
  assert.equal(result.compatGovernance.required, true);
  assert.equal(result.compatGovernance.compatShareWindow, 0.21);
  assert.equal(result.failures.includes('compat_share_window_exceeded'), true);
});

test('phase756: strict release policy uses runtime-summary-enriched candidate before soft-floor evaluation', () => {
  const baseline = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase756_baseline_scorecard_soft_floor_uplift.json'
  ]);
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = runNode([
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_candidate_scorecard_soft_floor_uplift.json'
  ]);
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const mustPass = runNode([
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase756_must_pass_soft_floor_uplift.json'
  ]);
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const summarySeed = JSON.parse(fs.readFileSync(path.join(ROOT, 'benchmarks/frozen/v1/runtime_summary_snapshot.v1.json'), 'utf8'));
  summarySeed.runtimeSummarySource = 'seeded_from_frozen_runtime_snapshot';
  fs.writeFileSync(
    path.join(ROOT, 'tmp', 'phase756_summary_soft_floor_uplift.json'),
    `${JSON.stringify(summarySeed, null, 2)}\n`
  );

  const strict = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase756_baseline_scorecard_soft_floor_uplift.json',
    '--candidate', 'tmp/phase756_candidate_scorecard_soft_floor_uplift.json',
    '--mustPass', 'tmp/phase756_must_pass_soft_floor_uplift.json',
    '--summary', 'tmp/phase756_summary_soft_floor_uplift.json',
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--requireCompatGovernance', 'true',
    '--requireSoftFloor', 'true',
    '--requireNoGoGateMandatory', 'true',
    '--output', 'tmp/phase756_release_policy_soft_floor_uplift.json'
  ]);
  assert.equal(strict.status, 0, strict.stderr || strict.stdout);

  const result = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'tmp', 'phase756_release_policy_soft_floor_uplift.json'), 'utf8')
  );
  assert.equal(result.ok, true);
  assert.equal(result.candidateSourceType, 'runtime_summary');
  assert.equal(result.failures.some((item) => String(item).startsWith('soft_floor_unmet:')), false);
  assert.equal(result.softFloorChecks.some((row) => row.key === 'procedural_utility' && row.pass === true), true);
  assert.equal(result.softFloorChecks.some((row) => row.key === 'latency_surface_efficiency' && row.pass === true), true);
});
