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

test('phase862: guarded loop stops when repo-side kill switch is enabled', (t) => {
  const tempRoot = makeTempRoot('phase862-kill-switch-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: []
  });
  writeRuntimeStateFixture(runtimeStatePath, {
    global: {
      killSwitch: true,
      publicWriteSafety: {
        killSwitchOn: true,
        failCloseMode: true,
        trackAuditWriteMode: 'audit_only',
        readError: false,
        source: 'fixture'
      }
    }
  });

  const result = runLoop({
    policyPath,
    outputRoot: path.join(tempRoot, 'artifacts'),
    runtimeStatePath,
    now: '2026-03-25T12:30:00.000Z'
  });

  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'kill_switch_stop');

  const trace = readJson(result.tracePath);
  const latestSummary = readJson(result.latestSummaryPath);

  assert.equal(trace.failure_reason, 'kill_switch_stop');
  assert.equal(latestSummary.decision, 'kill_switch_stop');
});
