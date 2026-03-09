'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase755: quality gate uses runtime summary fallback when tmp summary is missing', () => {
  const run = spawnSync('node', [
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--summary', 'tmp/phase755_missing_summary.json',
    '--summaryFallback', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--output', 'tmp/phase755_quality_gate_result.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const result = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase755_quality_gate_result.json'), 'utf8'));
  assert.equal(result.ok, true);
  assert.match(String(result.candidateSourcePath || ''), /usage_summary_candidate\.v1\.json$/);
  assert.equal(result.candidateScorecard.source.endsWith('usage_summary_candidate.v1.json'), true);
});
