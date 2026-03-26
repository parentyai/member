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

test('phase862: guarded loop skips when hourly cap is already reached', (t) => {
  const tempRoot = makeTempRoot('phase862-hourly-cap-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const artifactRoot = path.join(tempRoot, 'artifacts');
  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: []
  });
  writeRuntimeStateFixture(runtimeStatePath);
  writeLoopState(artifactRoot, {
    updated_at: '2026-03-25T12:20:00.000Z',
    failure_streak: 0,
    last_run_id: 'run_prev_2',
    last_failure_reason: 'dry_run_only_skip',
    recent_runs: [
      {
        run_id: 'run_prev_1',
        started_at: '2026-03-25T12:01:00.000Z',
        finished_at: '2026-03-25T12:01:05.000Z',
        decision: 'dry_run_only_skip',
        target_id: 'sample-self-test',
        counted_towards_hourly_cap: true
      },
      {
        run_id: 'run_prev_2',
        started_at: '2026-03-25T12:10:00.000Z',
        finished_at: '2026-03-25T12:10:05.000Z',
        decision: 'dry_run_only_skip',
        target_id: 'sample-self-test',
        counted_towards_hourly_cap: true
      }
    ],
    last_decision: {
      decision: 'dry_run_only_skip',
      allowed: true,
      counted_towards_hourly_cap: true,
      at: '2026-03-25T12:10:05.000Z',
      target_id: 'sample-self-test',
      run_id: 'run_prev_2',
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
  assert.equal(result.decision, 'max_runs_per_hour_skip');
  assert.equal(result.countedRunsLastHour, 2);

  const trace = readJson(result.tracePath);
  const state = readJson(result.statePath);

  assert.equal(trace.failure_reason, 'max_runs_per_hour_skip');
  assert.equal(state.failure_streak, 0);
  assert.equal(state.last_decision.decision, 'max_runs_per_hour_skip');
});
