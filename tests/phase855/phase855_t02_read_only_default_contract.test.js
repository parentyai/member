'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol jobs stay read-only by default', async () => {
  const outputPath = tempJsonPath('readonly');
  const deps = buildPatrolDeps();
  const result = await run([
    'node',
    'tools/run_quality_patrol.js',
    '--output',
    outputPath
  ], deps);

  assert.equal(result.artifact.writeStatus.requested.issues, false);
  assert.equal(result.artifact.writeStatus.requested.backlog, false);
  assert.equal(result.artifact.runtimeFetchStatus.writeIssues.status, 'disabled');
  assert.equal(result.artifact.runtimeFetchStatus.writeBacklog.status, 'disabled');
  assert.equal(deps.__writeCalls.length, 0);

  cleanupPaths(outputPath);
});
