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

test('phase862: guarded loop stops during blocked hours and writes trace evidence', (t) => {
  const tempRoot = makeTempRoot('phase862-blocked-hours-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');

  writePolicy(policyPath, {
    enabled: true
  });
  writeRuntimeStateFixture(runtimeStatePath);

  const result = runLoop({
    policyPath,
    outputRoot: path.join(tempRoot, 'artifacts'),
    runtimeStatePath,
    now: '2026-03-25T05:30:00-04:00'
  });

  assert.equal(result.ok, true);
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'blocked_hours_skip');
  assert.ok(fs.existsSync(result.tracePath));
  assert.ok(fs.existsSync(result.statePath));
  assert.ok(fs.existsSync(result.latestSummaryPath));

  const trace = readJson(result.tracePath);
  const latestSummary = readJson(result.latestSummaryPath);
  const state = readJson(result.statePath);

  assert.equal(trace.failure_reason, 'blocked_hours_skip');
  assert.equal(trace.observation_status, 'guard_stopped_pr6');
  assert.equal(latestSummary.decision, 'blocked_hours_skip');
  assert.equal(state.last_decision.decision, 'blocked_hours_skip');
  assert.equal(state.failure_streak, 0);
});
