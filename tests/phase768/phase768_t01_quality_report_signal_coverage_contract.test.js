'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

function runQualityReport(summaryPayload, outputFileName) {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase768-report-'));
  const summaryPath = path.join(workDir, 'summary.json');
  const outPath = path.join(workDir, outputFileName);
  fs.writeFileSync(summaryPath, `${JSON.stringify(summaryPayload, null, 2)}\n`);

  const run = spawnSync('node', [
    'tools/llm_quality/build_quality_report.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--summary', summaryPath,
    '--output', outPath
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  return JSON.parse(fs.readFileSync(outPath, 'utf8'));
}

test('phase768: empty conversationQuality does not emit synthetic japanese/line failures', () => {
  const report = runQualityReport({ summary: { conversationQuality: {} } }, 'report-empty.json');

  assert.equal(Array.isArray(report.top_10_japanese_service_failures), true);
  assert.equal(Array.isArray(report.top_10_line_fit_failures), true);
  assert.equal(report.top_10_japanese_service_failures.length, 0);
  assert.equal(report.top_10_line_fit_failures.length, 0);
  assert.equal(report.signal_coverage.conversationQualityPresent, false);
  assert.equal(report.signal_coverage.requiredSignalCount, 35);
  assert.equal(report.signal_coverage.availableSignalCount, 0);
  assert.equal(report.signal_coverage.missingSignalCount, 35);
});

test('phase768: partial conversationQuality emits only available failure signals', () => {
  const report = runQualityReport({
    summary: {
      conversationQuality: {
        defaultCasualRate: 0.14,
        avgActionCount: 4
      }
    }
  }, 'report-partial.json');

  const jpSignals = report.top_10_japanese_service_failures.map((row) => row.signal);
  const lineSignals = report.top_10_line_fit_failures.map((row) => row.signal);

  assert.deepEqual(jpSignals, ['defaultCasualRate']);
  assert.deepEqual(lineSignals, ['avgActionCountOverBudget', 'defaultCasualRate']);
  assert.equal(report.signal_coverage.requiredSignalCount, 35);
  assert.equal(report.signal_coverage.availableSignalCount, 2);
  assert.equal(report.signal_coverage.missingSignalCount, 33);
});
