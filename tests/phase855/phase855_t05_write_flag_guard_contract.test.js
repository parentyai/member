'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol_detection');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: write flags stay guarded and backlog write requires issue write', async () => {
  const backlogOnlyPath = tempJsonPath('backlog_only');
  const depsBacklogOnly = buildPatrolDeps();
  const backlogOnly = await run([
    'node',
    'tools/run_quality_patrol_detection.js',
    '--output',
    backlogOnlyPath,
    '--write-backlog',
    'true'
  ], depsBacklogOnly);

  assert.equal(backlogOnly.artifact.writeStatus.executed.issues, false);
  assert.equal(backlogOnly.artifact.writeStatus.executed.backlog, false);
  assert.ok(backlogOnly.artifact.writeStatus.skipped.includes('write_backlog_requires_write_issues'));
  assert.equal(depsBacklogOnly.__writeCalls.length, 0);

  const writePath = tempJsonPath('write_ok');
  const depsWrite = buildPatrolDeps();
  const persisted = await run([
    'node',
    'tools/run_quality_patrol_detection.js',
    '--output',
    writePath,
    '--write-issues',
    'true',
    '--write-backlog',
    'true'
  ], depsWrite);

  assert.equal(persisted.artifact.writeStatus.executed.issues, true);
  assert.equal(persisted.artifact.writeStatus.executed.backlog, true);
  assert.equal(depsWrite.__writeCalls.length, 1);

  cleanupPaths(backlogOnlyPath, writePath);
});
