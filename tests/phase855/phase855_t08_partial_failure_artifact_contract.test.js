'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol_planning');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: partial downstream failures still emit planning artifact with preserved degraded semantics', async () => {
  const outputPath = tempJsonPath('partial_failure');
  const deps = buildPatrolDeps({
    analyzeQualityIssues: async () => {
      throw new Error('root cause unavailable');
    },
    planQualityImprovements: async () => {
      throw new Error('planning unavailable');
    }
  });

  const result = await run([
    'node',
    'tools/run_quality_patrol_planning.js',
    '--output',
    outputPath
  ], deps);

  assert.equal(result.ok, true);
  assert.equal(result.artifact.analysisStatus, 'insufficient_evidence');
  assert.equal(result.artifact.planningStatus, 'insufficient_evidence');
  assert.equal(result.artifact.runtimeFetchStatus.rootCause.status, 'unavailable');
  assert.equal(result.artifact.runtimeFetchStatus.planning.status, 'unavailable');
  assert.ok(Array.isArray(result.artifact.recommendedPr));

  cleanupPaths(outputPath);
});
