'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_PATH = path.join(ROOT, 'tools', 'llm_quality', 'fixtures', 'usage_summary_candidate.v1.json');

function runGate(summaryPath, outputPath) {
  return spawnSync('node', [
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--summary', path.relative(ROOT, summaryPath),
    '--summaryFallback', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--output', path.relative(ROOT, outputPath),
    '--requireAllSlicesPass', 'true'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
}

function getDimension(scorecard, key) {
  const row = (scorecard.dimensions || []).find((item) => item && item.key === key);
  return row ? Number(row.score) : 0;
}

test('phase776: runtime gate uplifts continuity/recovery dimensions from conversation quality signals', () => {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const mutated = JSON.parse(JSON.stringify(seed));
  const dimensions = mutated.summary.qualityFramework.dimensions;
  dimensions.forEach((row) => {
    if (!row || typeof row.key !== 'string') return;
    if (['conversation_continuity', 'clarification_quality', 'empathy', 'misunderstanding_recovery', 'latency_surface_efficiency'].includes(row.key)) {
      row.score = 0.55;
    }
  });
  mutated.summary.qualityFramework.overallScore = 88.5;

  const summaryPath = path.join(ROOT, 'tmp', 'phase776_runtime_summary_enriched.json');
  const outputPath = path.join(ROOT, 'tmp', 'phase776_runtime_gate_result.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(mutated, null, 2)}\n`);

  const run = runGate(summaryPath, outputPath);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const candidate = payload.candidateScorecard;
  assert.equal(payload.candidateSourceType, 'runtime_summary');
  assert.equal(candidate.overallScore > 88.5, true);
  assert.equal(getDimension(candidate, 'conversation_continuity') >= 0.85, true);
  assert.equal(getDimension(candidate, 'clarification_quality') >= 0.85, true);
  assert.equal(getDimension(candidate, 'misunderstanding_recovery') >= 0.85, true);
  assert.equal(getDimension(candidate, 'latency_surface_efficiency') >= 0.85, true);
  assert.equal(getDimension(candidate, 'procedural_utility') >= 0.8, true);
  assert.equal(getDimension(candidate, 'next_step_clarity') >= 0.8, true);
  assert.equal(getDimension(candidate, 'japanese_naturalness') >= 0.8, true);
  assert.equal(getDimension(candidate, 'keigo_distance') >= 0.8, true);
});

test('phase776: runtime gate keeps precomputed low dimensions when conversation quality is absent', () => {
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const mutated = JSON.parse(JSON.stringify(seed));
  delete mutated.summary.conversationQuality;
  const dimensions = mutated.summary.qualityFramework.dimensions;
  dimensions.forEach((row) => {
    if (!row || typeof row.key !== 'string') return;
    if (row.key === 'conversation_continuity') row.score = 0.58;
  });
  mutated.summary.qualityFramework.overallScore = 89.1;

  const summaryPath = path.join(ROOT, 'tmp', 'phase776_runtime_summary_no_conversation.json');
  const outputPath = path.join(ROOT, 'tmp', 'phase776_runtime_gate_no_conversation.json');
  fs.writeFileSync(summaryPath, `${JSON.stringify(mutated, null, 2)}\n`);

  const run = runGate(summaryPath, outputPath);
  assert.equal(run.status, 0, run.stderr || run.stdout);

  const payload = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  const continuity = getDimension(payload.candidateScorecard, 'conversation_continuity');
  assert.equal(Math.abs(continuity - 0.58) < 0.0001, true);
});
