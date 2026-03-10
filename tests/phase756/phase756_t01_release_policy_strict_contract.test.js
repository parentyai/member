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
        avgRepeatRiskScore: 0.62
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
