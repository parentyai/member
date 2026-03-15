'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run: runPatrol } = require('../../tools/run_quality_patrol');
const { run: runMetrics } = require('../../tools/run_quality_patrol_metrics');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('../phase855/phase855_helpers');

test('phase856: main and metrics artifacts surface backlog separation without breaking existing shape', async () => {
  const latestOutput = tempJsonPath('backlog_separation_latest');
  const metricsOutput = tempJsonPath('backlog_separation_metrics');
  const deps = buildPatrolDeps();

  await runPatrol([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    latestOutput
  ], deps);
  await runMetrics([
    'node',
    'tools/run_quality_patrol_metrics.js',
    '--output',
    metricsOutput
  ], deps);

  const latestArtifact = JSON.parse(fs.readFileSync(latestOutput, 'utf8'));
  const metricsArtifact = JSON.parse(fs.readFileSync(metricsOutput, 'utf8'));

  assert.equal(latestArtifact.artifactVersion, 'quality_patrol_job_v1');
  assert.ok(latestArtifact.summary);
  assert.ok(Array.isArray(latestArtifact.issues));
  assert.ok(latestArtifact.backlogSeparation);
  assert.ok(latestArtifact.backlogSeparation.currentRuntime);
  assert.ok(latestArtifact.backlogSeparation.historicalDebt);
  assert.ok(latestArtifact.backlogSeparation.backlogSeparationGate);

  assert.equal(metricsArtifact.artifactVersion, 'quality_patrol_metrics_job_v1');
  assert.ok(metricsArtifact.metrics);
  assert.ok(metricsArtifact.decayAwareReadiness);
  assert.ok(metricsArtifact.decayAwareOpsGate);
  assert.ok(metricsArtifact.backlogSeparation);
  assert.ok(metricsArtifact.backlogSeparation.backlogSeparationGate);

  cleanupPaths(latestOutput, metricsOutput);
});
