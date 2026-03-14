'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { queryLatestPatrolInsights } = require('../../src/usecases/qualityPatrol/queryLatestPatrolInsights');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: main patrol job artifact keeps parity with the read-only query contract', async () => {
  const outputPath = tempJsonPath('parity');
  const deps = buildPatrolDeps();
  const extracted = await deps.buildConversationReviewUnitsFromSources();
  const evaluated = await deps.evaluateConversationReviewUnits();
  const kpiResult = await deps.buildPatrolKpisFromEvaluations();
  const detectionResult = deps.detectIssues();
  const rootCauseResult = await deps.analyzeQualityIssues();
  const planResult = await deps.planQualityImprovements();
  const result = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'newly-detected-improvements',
    '--output',
    outputPath
  ], deps);

  const direct = await queryLatestPatrolInsights({
    mode: 'newly-detected-improvements',
    audience: 'operator',
    reviewUnits: extracted.reviewUnits,
    evaluations: evaluated.evaluations,
    kpiResult,
    detectionResult,
    rootCauseResult,
    planResult
  }, deps);
  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));

  assert.deepEqual(artifact.summary, direct.summary);
  assert.deepEqual(artifact.issues, direct.issues);
  assert.deepEqual(artifact.observationBlockers, direct.observationBlockers);
  assert.deepEqual(artifact.recommendedPr, direct.recommendedPr);

  cleanupPaths(outputPath);
});
