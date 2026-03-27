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

const ROOT = path.resolve(__dirname, '..', '..');
const SCENARIO_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json');

function buildPolicyAndRuntime(tempRoot) {
  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    allowed_targets: [
      {
        alias: 'sample-self-test',
        platform: 'line_desktop',
        target_kind: 'single_user',
        expected_chat_title: 'メンバー',
        expected_window_title_substring: 'LINE',
        expected_participant_labels: [],
        expected_ax_fingerprint: null,
        allowed_send_modes: ['execute'],
        notes: 'execute-only test target'
      }
    ]
  });
  writeRuntimeStateFixture(runtimeStatePath);
  return { policyPath, runtimeStatePath, outputRoot };
}

test('phase876: execute harness stays fail-closed when visible rows are missing and post-send target validation no longer confirms the target', (t) => {
  const tempRoot = makeTempRoot('phase876-reply-gap-failclosed-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
  const { policyPath, runtimeStatePath, outputRoot } = buildPolicyAndRuntime(tempRoot);

  const code = `
import json
from pathlib import Path
from member_line_patrol import execute_harness as harness

class FakeAdapter:
    def probe_host(self):
        return {
            "platform": "Darwin",
            "platform_release": "24.0",
            "is_macos": True,
            "line_bundle_present": True,
            "tools": {
                "open": {"available": True},
                "osascript": {"available": True},
                "screencapture": {"available": True},
                "python3": {"available": True},
            },
        }

    def execute_open_test_chat(self, **kwargs):
        return {
            "status": "executed",
            "reason": "opened",
            "validation": {
                "status": "executed",
                "validation": {"matched": True, "reason": "matched"},
                "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "以前の行"}]}},
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - メンバー"}},
            },
        }

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake-image", encoding="utf-8")
        return {"status": "executed", "output_path": str(output_path)}

    def execute_send_text(self, message_text, **kwargs):
        return {
            "status": "executed",
            "reason": "sent",
            "result": {"status": "sent", "send_method": "return_fallback", "echoed_text": message_text},
        }

    def execute_validate_target(self, **kwargs):
        ax_output_path = kwargs.get("ax_output_path")
        visible_output_path = kwargs.get("visible_output_path")
        if ax_output_path:
            path_obj = Path(ax_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"window_name": "LINE - 別チャット"}), encoding="utf-8")
        if visible_output_path:
            path_obj = Path(visible_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"items": []}), encoding="utf-8")
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "output_path": str(ax_output_path), "payload_summary": {"window_name": "LINE - 別チャット"}},
            "visible_read": {"status": "executed", "output_path": str(visible_output_path), "payload_summary": {"items": []}},
            "validation": {"matched": False, "reason": "window_title_mismatch"},
        }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="Codex execute smoke",
    adapter_factory=lambda: FakeAdapter(),
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const trace = readJson(result.tracePath);
  assert.equal(trace.correlation_status, 'post_visible_missing');
  assert.notEqual(trace.correlation_status, 'post_send_reply_missing');
});
