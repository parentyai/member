'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

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
