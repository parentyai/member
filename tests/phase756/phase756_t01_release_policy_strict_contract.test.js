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

test('phase756: strict release policy blocks warning slices and strict runtime signals', () => {
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
        defaultCasualRate: 0.12,
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
  assert.equal(result.failures.some((item) => String(item).startsWith('slice_failed_or_not_improved:')), true);
});
