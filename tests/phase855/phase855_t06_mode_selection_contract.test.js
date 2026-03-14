'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol job preserves requested query modes and falls back to latest only for invalid values', async () => {
  const nextBestPath = tempJsonPath('next_best');
  const nextBest = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'next-best-pr',
    '--output',
    nextBestPath
  ], buildPatrolDeps());
  assert.equal(nextBest.artifact.mode, 'next-best-pr');

  const invalidPath = tempJsonPath('invalid');
  const invalid = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'not-a-mode',
    '--output',
    invalidPath
  ], buildPatrolDeps());
  assert.equal(invalid.artifact.mode, 'latest');

  cleanupPaths(nextBestPath, invalidPath);
});
