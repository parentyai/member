'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runPythonCode,
  writePolicy,
  writeRuntimeStateFixture
} = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase869: execute harness stops before send when target does not allow execute', (t) => {
  const tempRoot = makeTempRoot('phase869-execute-guard-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRoot = path.join(tempRoot, 'artifacts');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: []
  });
  writeRuntimeStateFixture(runtimeStatePath);

  const code = `
import json
from member_line_patrol import execute_harness as harness

class FakeAdapter:
    def probe_host(self):
        return {
            "platform": "Darwin",
            "platform_release": "24.0",
            "is_macos": True,
            "line_app_name": "LINE",
            "line_bundle_id": "jp.naver.line.mac",
            "line_bundle_path": "/Applications/LINE.app",
            "line_bundle_present": True,
            "tools": {},
        }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(path.join(path.resolve(__dirname, '..', '..'), 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'))},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    adapter_factory=lambda: FakeAdapter(),
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const trace = readJson(result.tracePath);

  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'target_execute_not_allowed');
  assert.equal(trace.failure_reason, 'target_execute_not_allowed');
});
