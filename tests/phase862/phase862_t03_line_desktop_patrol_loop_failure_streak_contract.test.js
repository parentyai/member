'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runLoop,
  writeLoopState,
  writePolicy,
  writeRuntimeStateFixture
} = require('./_line_desktop_patrol_loop_test_helper');

test('phase862: guarded loop stops when failure streak threshold is already reached', (t) => {
  const tempRoot = makeTempRoot('phase862-failure-streak-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const artifactRoot = path.join(tempRoot, 'artifacts');
  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    failure_streak_threshold: 3
  });
  writeRuntimeStateFixture(runtimeStatePath);
  writeLoopState(artifactRoot, {
    updated_at: '2026-03-25T12:20:00.000Z',
    failure_streak: 3,
    last_run_id: 'run_prev_fail',
    last_failure_reason: 'ui_drift_stop',
    recent_runs: [],
    last_decision: {
      decision: 'ui_drift_stop',
      allowed: false,
      counted_towards_hourly_cap: false,
      at: '2026-03-25T12:20:00.000Z',
      target_id: 'sample-self-test',
      run_id: 'run_prev_fail',
      note: 'fixture'
    }
  });

  const result = runLoop({
    policyPath,
    outputRoot: artifactRoot,
    runtimeStatePath,
    now: '2026-03-25T12:30:00.000Z'
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'failure_streak_stop');

  const trace = readJson(result.tracePath);
  const state = readJson(result.statePath);

  assert.equal(trace.failure_reason, 'failure_streak_stop');
  assert.equal(state.failure_streak, 3);
  assert.equal(state.last_decision.decision, 'failure_streak_stop');
});
