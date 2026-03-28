'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { parsePatrolArgs } = require('../../tools/quality_patrol/lib');
const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol job cli parses mode, audience, outputs, and writes main artifact', async () => {
  const outputPath = tempJsonPath('main');
  const metricsPath = tempJsonPath('metrics');
  const detectionPath = tempJsonPath('detection');
  const planningPath = tempJsonPath('planning');
  const args = parsePatrolArgs([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'top-risk',
    '--audience',
    'human',
    '--output',
    outputPath,
    '--metrics-output',
    metricsPath,
    '--detection-output',
    detectionPath,
    '--planning-output',
    planningPath
  ]);

  assert.equal(args.mode, 'top-risk');
  assert.equal(args.audience, 'human');
  assert.equal(args.output, outputPath);
  assert.equal(args.metricsOutput, metricsPath);
  assert.equal(args.detectionOutput, detectionPath);
  assert.equal(args.planningOutput, planningPath);

  const result = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'top-risk',
    '--audience',
    'human',
    '--output',
    outputPath,
    '--metrics-output',
    metricsPath,
    '--detection-output',
    detectionPath,
    '--planning-output',
    planningPath
  ], buildPatrolDeps());

  assert.equal(result.ok, true);
  assert.equal(result.outputPath, outputPath);
  assert.equal(result.outputs.metrics, metricsPath);
  assert.equal(result.outputs.detection, detectionPath);
  assert.equal(result.outputs.planning, planningPath);

  cleanupPaths(outputPath, metricsPath, detectionPath, planningPath);
});

test('phase855: patrol job cli defaults traceLimit to the current review limit', () => {
  const args = parsePatrolArgs([
    'node',
    'tools/run_quality_patrol.js',
    '--limit',
    '120'
  ]);

  assert.equal(args.limit, 120);
  assert.equal(args.traceLimit, 120);
});
