'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase750: package scripts include quality framework gate and catchup gate wiring', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(typeof pkg.scripts['llm:quality:gate'], 'string');
  assert.match(pkg.scripts['llm:quality:gate'], /LLM_QUALITY_REQUIRE_ALL_SLICES_PASS=true/);
  assert.equal(typeof pkg.scripts['llm:quality:baseline'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:candidate'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:diff'], 'string');
  assert.match(pkg.scripts['llm:quality:release-policy'], /LLM_QUALITY_REQUIRE_ALL_SLICES_PASS=true/);
  assert.match(pkg.scripts['catchup:gate:pr'], /llm:quality:gate/);
});

test('phase750: quality gate command succeeds on frozen baseline/candidate fixtures', () => {
  const run = spawnSync('node', [
    'tools/llm_quality/run_quality_gate.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--adjudication', 'tools/llm_quality/fixtures/human_adjudication_set.v1.json',
    '--manifest', 'benchmarks/registry/manifest.v1.json',
    '--output', 'tmp/phase750_quality_gate_result.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase750_quality_gate_result.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.candidateScorecard.hardGate.pass, true);
});
