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
  assert.equal(typeof pkg.scripts['llm:quality:runtime-summary:prepare'], 'string');
  assert.match(pkg.scripts['llm:quality:gate'], /llm:quality:runtime-summary:prepare/);
  assert.match(pkg.scripts['llm:quality:gate'], /LLM_QUALITY_REQUIRE_ALL_SLICES_PASS=true/);
  assert.equal(typeof pkg.scripts['llm:quality:baseline'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:candidate'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:diff'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:register-failures'], 'string');
  assert.equal(typeof pkg.scripts['llm:quality:counterexample-queue'], 'string');
  assert.match(pkg.scripts['llm:quality:report'], /llm:quality:register-failures/);
  assert.match(pkg.scripts['llm:quality:report'], /llm:quality:counterexample-queue/);
  assert.match(pkg.scripts['llm:quality:release-policy'], /LLM_QUALITY_REQUIRE_ALL_SLICES_PASS=true/);
  assert.match(pkg.scripts['catchup:gate:pr'], /llm:quality:gate/);
  assert.match(pkg.scripts['catchup:gate:pr'], /llm:quality:report/);
});

test('phase750: quality gate script seeds runtime summary and suppresses runtime-summary warning', () => {
  const run = spawnSync('npm', [
    'run',
    'llm:quality:gate'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const payload = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'llm_quality_gate_result.json'), 'utf8'));
  assert.equal(payload.ok, true);
  assert.equal(payload.candidateScorecard.hardGate.pass, true);
  assert.equal(payload.candidateSourceType, 'runtime_summary');
  assert.equal(Array.isArray(payload.warnings) && payload.warnings.includes('runtime_summary_not_used'), false);
});
