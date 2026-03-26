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

test('phase867: dry-run harness preserves AX status when visible message read degrades', (t) => {
  const tempRoot = makeTempRoot('phase867-dry-run-visible-skip-');
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

    def plan_read_visible_messages(self, output_path, target_process_name="LINE", max_items=20, timeout_seconds=2.0):
        return {
            "status": "planned",
            "target_process_name": target_process_name,
            "command": {"argv": ["osascript", "-e", "fake visible read"]},
            "output_path": str(output_path),
            "max_items": max_items,
            "timeout_seconds": timeout_seconds,
        }

    def execute_dump_ax_tree(self, output_path, target_process_name="LINE", timeout_seconds=2.0):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "process_name": target_process_name,
            "frontmost": True,
            "window_count": 1,
            "window_name": "Codex Self Test",
            "ui_elements_enabled": True,
        }
        output_path.write_text(json.dumps(payload), encoding="utf-8")
        return {
            "status": "executed",
            "probe": self.probe_host(),
            "plan": self.plan_dump_ax_tree(output_path, target_process_name=target_process_name, timeout_seconds=timeout_seconds),
            "result": {"status": "ok", "returncode": 0, "stdout": None, "stderr": None},
            "output_path": str(output_path),
            "file_exists": True,
            "file_size": output_path.stat().st_size,
            "payload_summary": payload,
        }

    def execute_read_visible_messages(self, output_path, target_process_name="LINE", max_items=20, timeout_seconds=2.0):
        return {
            "status": "failed",
            "reason": "osascript_failed",
            "probe": self.probe_host(),
            "plan": self.plan_read_visible_messages(output_path, target_process_name=target_process_name, max_items=max_items, timeout_seconds=timeout_seconds),
            "result": {"status": "failed", "returncode": 1, "stdout": None, "stderr": "assistive access denied"},
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
  assert.equal(trace.observation_status, 'ax_dump_completed_pr9');
  assert.deepEqual(trace.visible_after, []);
  assert.ok(typeof trace.ax_tree_after === 'string' && trace.ax_tree_after.endsWith('/after.ax.json'));
  assert.equal(trace.observation_artifacts.read_visible_messages.reason, 'osascript_failed');
  assert.equal(trace.observation_artifacts.read_visible_messages.result.status, 'failed');
});
