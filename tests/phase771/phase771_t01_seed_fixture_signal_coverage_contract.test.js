'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase771: seeded candidate summary keeps runtime conversation signal coverage complete', () => {
  const outPath = path.join(ROOT, 'tmp', 'phase771_runtime_summary.json');
  const reportPath = path.join(ROOT, 'tmp', 'phase771_quality_report.json');
  const gatePath = path.join(ROOT, 'tmp', 'phase771_quality_gate.json');
  const registerPath = path.join(ROOT, 'tmp', 'phase771_failure_register.json');

  const prepare = spawnSync('node', [
    'tools/llm_quality/prepare_runtime_summary.js',
    '--refresh', 'true',
    '--output', 'tmp/phase771_runtime_summary.json',
    '--seed', 'tools/llm_quality/fixtures/usage_summary_candidate.v1.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(prepare.status, 0, prepare.stderr || prepare.stdout);

  const report = spawnSync('node', [
    'tools/llm_quality/build_quality_report.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--summary', 'tmp/phase771_runtime_summary.json',
    '--output', 'tmp/phase771_quality_report.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(report.status, 0, report.stderr || report.stdout);

  fs.writeFileSync(gatePath, `${JSON.stringify({ failures: [] }, null, 2)}\n`);
  const register = spawnSync('node', [
    'tools/llm_quality/register_top_failures.js',
    '--report', 'tmp/phase771_quality_report.json',
    '--gate', 'tmp/phase771_quality_gate.json',
    '--output', 'tmp/phase771_failure_register.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(register.status, 0, register.stderr || register.stdout);

  const reportPayload = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  assert.equal(reportPayload.signal_coverage.missingSignalCount, 0);
  assert.equal(reportPayload.signal_coverage.availableSignalCount, reportPayload.signal_coverage.requiredSignalCount);

  const registerPayload = JSON.parse(fs.readFileSync(registerPath, 'utf8'));
  const entries = Array.isArray(registerPayload.latest && registerPayload.latest.entries)
    ? registerPayload.latest.entries
    : [];
  assert.equal(entries.some((row) => row.category === 'runtime_signal_gap'), false);
});
