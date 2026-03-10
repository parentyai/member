'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase777: quality report includes soft-floor threshold and ranked soft-floor gaps', () => {
  const baselineScorecardPath = path.join(ROOT, 'tmp', 'phase777_report_baseline_scorecard.json');
  const candidateScorecardPath = path.join(ROOT, 'tmp', 'phase777_report_candidate_scorecard.json');
  const baseline = spawnSync('node', [
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--output', path.relative(ROOT, baselineScorecardPath)
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(baseline.status, 0, baseline.stderr || baseline.stdout);
  const candidate = spawnSync('node', [
    'tools/llm_quality/compute_scorecard.js',
    '--input', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--output', path.relative(ROOT, candidateScorecardPath)
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(candidate.status, 0, candidate.stderr || candidate.stdout);

  const outPath = path.join(ROOT, 'tmp', 'phase777_quality_report.json');
  const run = spawnSync('node', [
    'tools/llm_quality/build_quality_report.js',
    '--baseline', path.relative(ROOT, baselineScorecardPath),
    '--candidate', path.relative(ROOT, candidateScorecardPath),
    '--summary', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--output', path.relative(ROOT, outPath)
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.soft_floor_threshold, 0.8);
  assert.equal(Array.isArray(payload.soft_floor_gaps), true);
  assert.equal(payload.soft_floor_gaps.length > 0, true);
  assert.equal(payload.soft_floor_gaps.length <= 10, true);
  assert.equal(payload.soft_floor_gaps.some((row) => row.key === 'procedural_utility'), true);
  assert.equal(payload.soft_floor_gaps.some((row) => row.key === 'next_step_clarity'), true);
  assert.equal(payload.soft_floor_gaps.every((row) => Number(row.gap) > 0), true);
  for (let i = 1; i < payload.soft_floor_gaps.length; i += 1) {
    assert.equal(payload.soft_floor_gaps[i - 1].gap >= payload.soft_floor_gaps[i].gap, true);
  }
});
