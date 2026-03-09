'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase751: must-pass fixtures and release-policy scripts succeed with bundled artifacts', () => {
  const mustPass = spawnSync('node', [
    'tools/llm_quality/run_must_pass_fixtures.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase751_must_pass.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(mustPass.status, 0, mustPass.stderr || mustPass.stdout);

  const baseline = spawnSync('node', [
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', 'tmp/phase751_baseline_scorecard.json'
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);

  const candidate = spawnSync('node', [
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase751_candidate_scorecard.json'
  ], { cwd: ROOT, encoding: 'utf8' });
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const releasePolicy = spawnSync('node', [
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', 'tmp/phase751_baseline_scorecard.json',
    '--candidate', 'tmp/phase751_candidate_scorecard.json',
    '--mustPass', 'tmp/phase751_must_pass.json',
    '--output', 'tmp/phase751_release_policy.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(releasePolicy.status, 0, releasePolicy.stderr || releasePolicy.stdout);
  const body = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase751_release_policy.json'), 'utf8'));
  assert.equal(body.ok, true);
  assert.equal(Array.isArray(body.failures), true);
  assert.equal(body.failures.length, 0);
});
