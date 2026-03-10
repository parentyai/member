'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function writeJson(relativePath, payload) {
  const fullPath = path.join(ROOT, relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(payload, null, 2)}\n`);
  return fullPath;
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
}

function runGate(extraArgs, outputName) {
  const outputPath = `tmp/${outputName}`;
  const run = spawnSync('node', [
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--output', outputPath
  ].concat(extraArgs || []), {
    cwd: ROOT,
    encoding: 'utf8'
  });
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, outputPath), 'utf8'));
  return { run, result };
}

test('phase755: quality gate prefers runtime summary when available', () => {
  const { run, result } = runGate([
    '--summary', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--summaryFallback', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json'
  ], 'phase755_quality_gate_runtime_result.json');

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.candidateSourceType, 'runtime_summary');
  assert.equal(result.runtimeSummaryConverted, true);
  assert.equal(Array.isArray(result.warnings) && result.warnings.includes('runtime_summary_not_used'), false);
});

test('phase755: quality gate uses frozen summary fallback when runtime summary is missing', () => {
  const { run, result } = runGate([
    '--summary', 'tmp/phase755_missing_summary.json',
    '--summaryFallback', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json'
  ], 'phase755_quality_gate_fallback_result.json');

  assert.equal(run.status, 0, run.stderr || run.stdout);
  assert.equal(result.ok, true);
  assert.equal(result.candidateSourceType, 'frozen_summary_fallback');
  assert.equal(result.runtimeSummaryConverted, false);
  assert.equal(Array.isArray(result.warnings) && result.warnings.includes('runtime_summary_not_used'), true);
  assert.match(String(result.candidateSourcePath || ''), /usage_summary_candidate\.v1\.json$/);
});

test('phase755: strict runtime summary requirement fails when runtime summary is missing', () => {
  const { run, result } = runGate([
    '--summary', 'tmp/phase755_missing_summary.json',
    '--summaryFallback', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--requireRuntimeSummary', 'true'
  ], 'phase755_quality_gate_runtime_strict_result.json');

  assert.equal(run.status, 1, run.stderr || run.stdout);
  assert.equal(result.ok, false);
  assert.equal(result.requireRuntimeSummary, true);
  assert.equal(result.candidateSourceType, 'frozen_summary_fallback');
  assert.equal(Array.isArray(result.failures) && result.failures.includes('runtime_summary_required_but_missing'), true);
});

test('phase755: strict runtime provenance rejects fixture-seeded runtime summary', () => {
  const seeded = readJson('tools/llm_quality/fixtures/usage_summary_candidate.v1.json');
  seeded.runtimeSummarySource = 'seeded_from_fixture';
  writeJson('tmp/phase755_bad_provenance_summary.json', seeded);

  const { run, result } = runGate([
    '--summary', 'tmp/phase755_bad_provenance_summary.json',
    '--requireRuntimeSummary', 'true',
    '--requireRuntimeProvenance', 'true'
  ], 'phase755_quality_gate_bad_provenance_result.json');

  assert.equal(run.status, 1, run.stderr || run.stdout);
  assert.equal(result.ok, false);
  assert.equal(
    Array.isArray(result.failures) && result.failures.includes('runtime_summary_provenance_invalid:seeded_from_fixture'),
    true
  );
});

test('phase755: strict compat governance blocks excessive compat share', () => {
  const summary = readJson('benchmarks/frozen/v1/runtime_summary_snapshot.v1.json');
  summary.runtimeSummarySource = 'seeded_from_frozen_runtime_snapshot';
  summary.summary = summary.summary || {};
  summary.summary.optimization = Object.assign({}, summary.summary.optimization, {
    compatShareWindow: 0.24
  });
  writeJson('tmp/phase755_high_compat_share_summary.json', summary);

  const { run, result } = runGate([
    '--summary', 'tmp/phase755_high_compat_share_summary.json',
    '--requireRuntimeSummary', 'true',
    '--requireRuntimeProvenance', 'true',
    '--requireCompatGovernance', 'true',
    '--maxCompatShare', '0.15'
  ], 'phase755_quality_gate_high_compat_share_result.json');

  assert.equal(run.status, 1, run.stderr || run.stdout);
  assert.equal(result.ok, false);
  assert.equal(result.compatShareWindow, 0.24);
  assert.equal(Array.isArray(result.failures) && result.failures.includes('compat_share_window_exceeded'), true);
});
