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

function prepareScorecardsAndFixtures(prefix) {
  const baselinePath = `tmp/${prefix}_baseline.json`;
  const candidatePath = `tmp/${prefix}_candidate.json`;
  const mustPassPath = `tmp/${prefix}_must_pass.json`;
  const summaryPath = `tmp/${prefix}_summary.json`;

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

  fs.writeFileSync(path.join(ROOT, summaryPath), `${JSON.stringify({
    summary: {
      conversationQuality: {}
    }
  }, null, 2)}\n`);

  return { baselinePath, candidatePath, mustPassPath, summaryPath };
}

test('phase769: strict release policy fails when runtime conversation signals are missing', () => {
  const paths = prepareScorecardsAndFixtures('phase769_strict');
  const outPath = 'tmp/phase769_release_policy_strict_missing.json';

  const strictRun = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', paths.baselinePath,
    '--candidate', paths.candidatePath,
    '--mustPass', paths.mustPassPath,
    '--summary', paths.summaryPath,
    '--requireAllSlicesPass', 'true',
    '--requireStrictRuntimeSignals', 'true',
    '--output', outPath
  ]);
  assert.notEqual(strictRun.status, 0);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, outPath), 'utf8'));
  assert.equal(payload.ok, false);
  assert.equal(payload.failures.some((row) => String(row).startsWith('runtime_signal_missing:')), true);
  assert.equal(payload.runtimeSignalCoverage.missingKeys.length, 8);
  assert.equal(payload.runtimeSignalCoverage.requiredKeys.includes('legacyTemplateHitRate'), true);
  assert.equal(payload.runtimeSignalCoverage.requiredKeys.includes('avgActionCount'), true);
});

test('phase769: non-strict release policy warns (but does not fail) when runtime signals are missing', () => {
  const paths = prepareScorecardsAndFixtures('phase769_warn');
  const outPath = 'tmp/phase769_release_policy_warn_missing.json';

  const nonStrictRun = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', paths.baselinePath,
    '--candidate', paths.candidatePath,
    '--mustPass', paths.mustPassPath,
    '--summary', paths.summaryPath,
    '--requireAllSlicesPass', 'true',
    '--output', outPath
  ]);
  assert.equal(nonStrictRun.status, 0, nonStrictRun.stderr || nonStrictRun.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, outPath), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.warnings.some((row) => String(row).startsWith('runtime_signal_missing:')), true);
  assert.equal(payload.runtimeSignalCoverage.missingKeys.length, 8);
});
