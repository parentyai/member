'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const {
  normalizeRuntimeSummarySource,
  isRuntimeSummaryProvenanceAccepted,
  isLiveRuntimeSummaryProvenance,
  resolveHarnessRunId,
  resolveQualityPolicyFlags,
  resolveHarnessArtifactPath
} = require('../../tools/llm_quality/harness_shared');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase750: shared harness policy and provenance helpers normalize runtime flags', () => {
  const policy = resolveQualityPolicyFlags({
    env: {
      LLM_QUALITY_REQUIRE_ALL_SLICES_PASS: 'true',
      LLM_QUALITY_REQUIRE_SOFT_FLOOR_080: '1',
      LLM_QUALITY_MAX_COMPAT_SHARE: '0.2',
      LLM_QUALITY_SOFT_FLOOR_VALUE: '0.7'
    },
    requireRuntimeSummary: '0',
    requireNoGoGateMandatory: true,
    requireStrictRuntimeSignals: 'yes'
  });

  assert.equal(policy.requireAllSlicesPass, true);
  assert.equal(policy.requireRuntimeSummary, false);
  assert.equal(policy.requireSoftFloor, true);
  assert.equal(policy.softFloorValue, 0.7);
  assert.equal(policy.maxCompatShare, 0.2);
  assert.equal(normalizeRuntimeSummarySource('Runtime_Live'), 'runtime_live');
  assert.equal(isRuntimeSummaryProvenanceAccepted('runtime_summary_live'), true);
  assert.equal(isLiveRuntimeSummaryProvenance('existing_runtime_summary_kept'), true);
  assert.equal(resolveHarnessRunId({ env: { LLM_QUALITY_RUN_ID: 'phase750-run' } }), 'phase750-run');
});

test('phase750: shared harness artifact path resolves to run-scoped mirror location', () => {
  const artifactPath = resolveHarnessArtifactPath({
    root: ROOT,
    runId: 'phase750-run',
    artifactGroup: 'report',
    outputPath: 'tmp/phase750_report.json'
  });

  assert.equal(
    artifactPath,
    path.join(ROOT, 'tmp', 'llm_quality_runs', 'phase750-run', 'report', 'phase750_report.json')
  );
});

test('phase750: compute_scorecard mirrors compatibility output into run-scoped artifact tree', () => {
  const runId = 'phase750-harness-mirror';
  const outputPath = path.join(ROOT, 'tmp', 'phase750_harness_scorecard.json');
  const mirrorPath = path.join(ROOT, 'tmp', 'llm_quality_runs', runId, 'scorecard', 'phase750_harness_scorecard.json');

  fs.rmSync(outputPath, { force: true });
  fs.rmSync(mirrorPath, { force: true });

  const run = spawnSync('node', [
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', 'tmp/phase750_harness_scorecard.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8',
    env: Object.assign({}, process.env, { LLM_QUALITY_RUN_ID: runId })
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(fs.existsSync(outputPath), true);
  assert.equal(fs.existsSync(mirrorPath), true);

  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(payload.frameworkVersion, 'v1');
});
