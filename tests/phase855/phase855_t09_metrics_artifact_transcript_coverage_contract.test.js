'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: metrics artifact includes transcript coverage diagnostics', async () => {
  const outputPath = tempJsonPath('main');
  const metricsPath = tempJsonPath('metrics');

  await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    outputPath,
    '--metrics-output',
    metricsPath
  ], buildPatrolDeps());

  const artifact = JSON.parse(fs.readFileSync(metricsPath, 'utf8'));
  assert.ok(artifact.transcriptCoverage);
  assert.ok(artifact.decayAwareReadiness);
  assert.equal(artifact.transcriptCoverage.transcriptWriteOutcomeCounts.written, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.assistant_reply_missing, 0);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.sanitized_reply_empty, 0);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.masking_removed_text, 0);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.region_prompt_fallback, 0);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.snapshotBuildAttempted.trueCount, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.assistantReplyPresent.trueCount, 1);
  assert.equal(artifact.transcriptCoverage.snapshotInputDiagnostics.snapshotBuildSkippedReason.assistant_reply_missing, 0);
  assert.equal(artifact.transcriptCoverage.transcriptCoverageStatus, 'ready');

  cleanupPaths(outputPath, metricsPath);
});
