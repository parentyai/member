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
} = require('./_line_desktop_patrol_screenshot_test_helper');

test('phase863: dry-run harness records screenshot_after when screenshot capture succeeds', (t) => {
  const tempRoot = makeTempRoot('phase863-dry-run-screenshot-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRoot = path.join(tempRoot, 'artifacts');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    store_screenshots: true
  });
  writeRuntimeStateFixture(runtimeStatePath);

  const code = `
import json
from datetime import datetime, timezone
from pathlib import Path
from member_line_patrol import dry_run_harness as harness

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
            "tools": {
                "open": {"available": True, "path": "/usr/bin/open"},
                "osascript": {"available": True, "path": "/usr/bin/osascript"},
                "screencapture": {"available": True, "path": "/usr/sbin/screencapture"},
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

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake screenshot bytes", encoding="utf-8")
        return {
            "status": "executed",
            "probe": self.probe_host(),
            "plan": self.plan_capture_screenshot(output_path),
            "result": {"status": "ok", "returncode": 0, "stdout": None, "stderr": None},
            "output_path": str(output_path),
            "file_exists": True,
            "file_size": output_path.stat().st_size,
        }

harness.MacOSLineDesktopAdapter = FakeAdapter
result = harness.run_dry_run_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(path.join(path.resolve(__dirname, '..', '..'), 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'))},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    current_time=datetime(2026, 3, 25, 12, 30, tzinfo=timezone.utc),
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const trace = readJson(result.tracePath);

  assert.equal(result.ok, true);
  assert.equal(trace.observation_status, 'screenshot_capture_completed_pr7');
  assert.ok(typeof trace.screenshot_after === 'string' && trace.screenshot_after.endsWith('/after.png'));
  assert.ok(fs.existsSync(trace.screenshot_after));
  assert.equal(trace.observation_artifacts.capture_screenshot.result.status, 'ok');
});
