'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const SEED_PATH = path.join(ROOT, 'tools', 'llm_quality', 'fixtures', 'usage_summary_candidate.v1.json');

test('phase755: runtime summary prepare seeds output when missing', () => {
  const outPath = path.join(ROOT, 'tmp', 'phase755_prepared_runtime_summary.json');
  try { fs.unlinkSync(outPath); } catch (_) {}

  const run = spawnSync('node', [
    'tools/llm_quality/prepare_runtime_summary.js',
    '--output', 'tmp/phase755_prepared_runtime_summary.json',
    '--seed', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(payload.summary && typeof payload.summary.qualityFramework === 'object', true);
  assert.equal(payload.summary && typeof payload.summary.conversationQuality === 'object', true);
  const conversation = payload.summary.conversationQuality;
  [
    'legacyTemplateHitRate',
    'defaultCasualRate',
    'followupQuestionIncludedRate',
    'conciseModeAppliedRate',
    'retrieveNeededRate',
    'avgActionCount',
    'directAnswerAppliedRate',
    'avgRepeatRiskScore'
  ].forEach((key) => {
    assert.equal(Number.isFinite(Number(conversation[key])), true, `missing conversation signal: ${key}`);
  });
  assert.equal(payload.runtimeSummarySource, 'seeded_from_fixture');
});

test('phase755: runtime summary prepare keeps existing valid summary', () => {
  const outPath = path.join(ROOT, 'tmp', 'phase755_existing_runtime_summary.json');
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const existing = Object.assign({}, seed, {
    runtimeSummarySource: 'existing_runtime_summary_kept',
    preparedAt: new Date().toISOString()
  });
  fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);

  const run = spawnSync('node', [
    'tools/llm_quality/prepare_runtime_summary.js',
    '--output', 'tmp/phase755_existing_runtime_summary.json',
    '--seed', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const output = JSON.parse(String(run.stdout || '{}'));
  assert.equal(output.mode, 'existing_runtime_summary_kept');
  const after = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(after.runtimeSummarySource, 'existing_runtime_summary_kept');
});

test('phase755: runtime summary prepare reseeds stale summary by default', () => {
  const outPath = path.join(ROOT, 'tmp', 'phase755_stale_runtime_summary.json');
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const stale = Object.assign({}, seed, {
    runtimeSummarySource: 'existing_runtime_summary_kept',
    preparedAt: '2020-01-01T00:00:00.000Z'
  });
  fs.writeFileSync(outPath, `${JSON.stringify(stale, null, 2)}\n`);

  const run = spawnSync('node', [
    'tools/llm_quality/prepare_runtime_summary.js',
    '--output', 'tmp/phase755_stale_runtime_summary.json',
    '--seed', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--max-age-minutes', '30'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const output = JSON.parse(String(run.stdout || '{}'));
  assert.equal(output.mode, 'existing_stale_reseeded');
  const after = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(after.runtimeSummarySource, 'existing_stale_reseeded');
});

test('phase755: runtime summary prepare supports forced refresh', () => {
  const outPath = path.join(ROOT, 'tmp', 'phase755_forced_refresh_runtime_summary.json');
  const seed = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const existing = Object.assign({}, seed, {
    runtimeSummarySource: 'existing_runtime_summary_kept',
    preparedAt: new Date().toISOString()
  });
  fs.writeFileSync(outPath, `${JSON.stringify(existing, null, 2)}\n`);

  const run = spawnSync('node', [
    'tools/llm_quality/prepare_runtime_summary.js',
    '--output', 'tmp/phase755_forced_refresh_runtime_summary.json',
    '--seed', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json',
    '--refresh', 'true'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const output = JSON.parse(String(run.stdout || '{}'));
  assert.equal(output.mode, 'forced_refresh_from_seed');
  const after = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(after.runtimeSummarySource, 'forced_refresh_from_seed');
});
