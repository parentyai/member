'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: degraded pipeline writes partial artifact without collapsing unavailable evidence into fail', async () => {
  const outputPath = tempJsonPath('degraded');
  const deps = buildPatrolDeps({
    buildConversationReviewUnitsFromSources: async () => {
      throw new Error('firestore unavailable');
    },
    evaluateConversationReviewUnits: async () => {
      throw new Error('evaluation unavailable');
    },
    buildPatrolKpisFromEvaluations: async () => {
      throw new Error('kpi unavailable');
    },
    detectIssues: () => {
      throw new Error('detection unavailable');
    },
    analyzeQualityIssues: async () => {
      throw new Error('root cause unavailable');
    },
    planQualityImprovements: async () => {
      throw new Error('planning unavailable');
    }
  });

  const result = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--output',
    outputPath
  ], deps);

  assert.equal(result.ok, true);
  assert.equal(result.artifact.runtimeFetchStatus.reviewUnits.status, 'unavailable');
  assert.ok(['insufficient_evidence', 'unavailable'].includes(result.artifact.observationStatus));
  assert.equal(result.artifact.analysisStatus, 'insufficient_evidence');
  assert.equal(result.artifact.planningStatus, 'insufficient_evidence');

  cleanupPaths(outputPath);
});
