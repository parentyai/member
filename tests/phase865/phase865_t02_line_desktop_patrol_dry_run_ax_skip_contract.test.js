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

test('phase865: dry-run harness degrades to skipped observation when AX dump is unavailable', (t) => {
  const tempRoot = makeTempRoot('phase865-dry-run-ax-skip-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRoot = path.join(tempRoot, 'artifacts');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    store_screenshots: false,
    store_ax_tree: true
  });
  writeRuntimeStateFixture(runtimeStatePath);

  const code = `
import json
from datetime import datetime, timezone
from member_line_patrol import dry_run_harness as harness

class FakeAdapter:
    def probe_host(self):
        return {
            "platform": "Linux",
            "platform_release": "6.0",
            "is_macos": False,
            "line_app_name": "LINE",
            "line_bundle_id": "jp.naver.line.mac",
            "line_bundle_path": None,
            "line_bundle_present": False,
            "tools": {
                "open": {"available": True, "path": "/usr/bin/open"},
                "osascript": {"available": False, "path": None},
                "screencapture": {"available": False, "path": None},
                "python3": {"available": True, "path": "/usr/bin/python3"},
            },
        }

    def plan_prepare_line_app(self, target_alias=None):
        return {"status": "planned", "target_alias": target_alias, "commands": []}

    def plan_capture_screenshot(self, output_path):
        return {
            "status": "planned",
            "command": {"argv": ["screencapture", "-x", str(output_path)]},
            "output_path": str(output_path),
        }

    def plan_dump_ax_tree(self, output_path, target_process_name="LINE", timeout_seconds=2.0):
        return {
            "status": "planned",
            "target_process_name": target_process_name,
            "command": {"argv": ["osascript", "-e", "fake ax dump"]},
            "output_path": str(output_path),
            "timeout_seconds": timeout_seconds,
        }

    def execute_dump_ax_tree(self, output_path, target_process_name="LINE", timeout_seconds=2.0):
        return {
            "status": "skipped",
            "reason": "host_not_macos",
            "probe": self.probe_host(),
            "plan": self.plan_dump_ax_tree(output_path, target_process_name=target_process_name, timeout_seconds=timeout_seconds),
        }

harness.MacOSLineDesktopAdapter = FakeAdapter
result = harness.run_dry_run_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(path.join(path.resolve(__dirname, '..', '..'), 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'))},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    current_time=datetime(2026, 3, 26, 12, 30, tzinfo=timezone.utc),
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const trace = readJson(result.tracePath);

  assert.equal(result.ok, true);
  assert.equal(trace.failure_reason, 'dry_run_only_skip');
  assert.equal(trace.ax_tree_after, null);
  assert.equal(trace.observation_status, 'ax_dump_skipped_pr9');
  assert.equal(trace.observation_artifacts.dump_ax_tree.reason, 'host_not_macos');
});
