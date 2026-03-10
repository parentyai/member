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

test('phase777: release policy emits soft-floor warnings when soft-floor is not required', () => {
  const paths = prepareArtifacts('phase777_warn');
  const outPath = path.join(ROOT, 'tmp', 'phase777_release_policy_warn.json');

  const run = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', paths.baselinePath,
    '--candidate', paths.candidatePath,
    '--mustPass', paths.mustPassPath,
    '--output', path.relative(ROOT, outPath)
  ]);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseGatePolicy.softFloorRequired, false);
  assert.equal(payload.releaseGatePolicy.softFloorValue, 0.8);
  assert.equal(payload.warnings.some((item) => String(item).startsWith('soft_floor_warning:')), true);
  assert.equal(payload.failures.some((item) => String(item).startsWith('soft_floor_unmet:')), false);
  assert.equal(Array.isArray(payload.softFloorChecks), true);
  assert.equal(payload.softFloorChecks.some((row) => row.key === 'procedural_utility' && row.pass === false), true);
});

test('phase777: release policy blocks below-floor dimensions when soft-floor is required', () => {
  const paths = prepareArtifacts('phase777_block');
  const outPath = path.join(ROOT, 'tmp', 'phase777_release_policy_block.json');

  const run = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', paths.baselinePath,
    '--candidate', paths.candidatePath,
    '--mustPass', paths.mustPassPath,
    '--requireSoftFloor', 'true',
    '--output', path.relative(ROOT, outPath)
  ]);
  assert.notEqual(run.status, 0);

  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.ok, false);
  assert.equal(payload.releaseGatePolicy.softFloorRequired, true);
  assert.equal(payload.failures.some((item) => String(item).startsWith('soft_floor_unmet:procedural_utility')), true);
  assert.equal(payload.failures.some((item) => String(item).startsWith('soft_floor_unmet:next_step_clarity')), true);
});

test('phase777: release policy accepts candidate when required soft-floor is lowered to 0.7', () => {
  const paths = prepareArtifacts('phase777_floor070');
  const outPath = path.join(ROOT, 'tmp', 'phase777_release_policy_floor070.json');

  const run = runNode([
    'tools/llm_quality/enforce_release_policy.js',
    '--baseline', paths.baselinePath,
    '--candidate', paths.candidatePath,
    '--mustPass', paths.mustPassPath,
    '--requireSoftFloor', 'true',
    '--softFloor', '0.7',
    '--output', path.relative(ROOT, outPath)
  ]);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.releaseGatePolicy.softFloorRequired, true);
  assert.equal(payload.releaseGatePolicy.softFloorValue, 0.7);
  assert.equal(payload.failures.some((item) => String(item).startsWith('soft_floor_unmet:')), false);
});
