'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runLoop,
  writePolicy,
  writeRuntimeStateFixture
} = require('./_line_desktop_patrol_loop_test_helper');

test('phase862: guarded loop falls through to the dry-run harness when guards pass', (t) => {
  const tempRoot = makeTempRoot('phase862-loop-allowed-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: []
  });
  writeRuntimeStateFixture(runtimeStatePath);

  const result = runLoop({
    policyPath,
    outputRoot: path.join(tempRoot, 'artifacts'),
    runtimeStatePath,
    now: '2026-03-25T12:30:00.000Z'
  });

  assert.equal(result.ok, true);
  assert.equal(result.allowed, true);
  assert.equal(result.decision, 'dry_run_only_skip');
  assert.equal(result.countedRunsLastHour, 1);

  const trace = readJson(result.tracePath);
  const latestSummary = readJson(result.latestSummaryPath);
  const state = readJson(result.statePath);

  assert.equal(trace.failure_reason, 'dry_run_only_skip');
  assert.equal(trace.dry_run_applied, true);
  assert.equal(latestSummary.decision, 'dry_run_only_skip');
  assert.equal(state.failure_streak, 0);
  assert.equal(state.last_decision.allowed, true);
});
