'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol job emits query-aligned output artifact shape', async () => {
  const outputPath = tempJsonPath('shape');
  await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    outputPath
  ], buildPatrolDeps());

  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(artifact.artifactVersion, 'quality_patrol_job_v1');
  assert.equal(artifact.mode, 'latest');
  assert.equal(artifact.audience, 'operator');
  assert.ok(artifact.generatedAt);
  assert.ok(artifact.summary);
  assert.ok(Array.isArray(artifact.issues));
  assert.ok(Array.isArray(artifact.observationBlockers));
  assert.ok(Array.isArray(artifact.evidence));
  assert.ok(Array.isArray(artifact.traceRefs));
  assert.ok(Array.isArray(artifact.recommendedPr));
  assert.ok(artifact.planningStatus);
  assert.ok(artifact.analysisStatus);
  assert.equal(artifact.provenance, 'quality_patrol_job');
  assert.ok(artifact.runtimeFetchStatus);

  cleanupPaths(outputPath);
});
