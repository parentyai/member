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
        expected_chat_title: 'Codex Self Test',
        expected_window_title_substring: 'LINE',
        expected_participant_labels: ['Self Test'],
        expected_ax_fingerprint: null,
        allowed_send_modes: ['execute'],
        notes: 'execute-only test target'
      }
    ]
  });
  writeRuntimeStateFixture(runtimeStatePath);
  return { policyPath, runtimeStatePath, outputRoot };
}

test('phase873: execute harness failure injection remains fail-closed for kill switch, target mismatch, send mismatch, and reply gaps', async (t) => {
  await t.test('mid-run kill switch flip stops before send', () => {
    const tempRoot = makeTempRoot('phase873-midrun-kill-switch-');
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

    def execute_open_test_chat(self, **kwargs):
        return {
            "status": "executed",
            "reason": "opened",
            "validation": {
                "status": "executed",
                "validation": {"matched": True, "reason": "matched"},
                "visible_read": {"status": "executed", "payload_summary": {"items": []}},
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - Codex Self Test"}},
            },
        }

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake-image", encoding="utf-8")
        return {"status": "executed", "output_path": str(output_path)}

    def execute_send_text(self, *args, **kwargs):
        raise AssertionError("send must not run after kill switch flips")

call_count = {"value": 0}

def fake_runtime_loader(repo_root, route_key, runtime_state_path):
    call_count["value"] += 1
    kill_switch = call_count["value"] >= 2
    return {
        "ok": True,
        "gitSha": "fixture_git_sha",
        "serviceMode": "member",
        "global": {"killSwitch": kill_switch},
    }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: FakeAdapter(),
    runtime_state_loader=fake_runtime_loader,
)
print(json.dumps(result))
`;

    const result = JSON.parse(runPythonCode(code));
    assert.equal(result.decision, 'kill_switch_stop');
  });

  await t.test('target mismatch stops before send', () => {
    const tempRoot = makeTempRoot('phase873-target-mismatch-');
    t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
    const { policyPath, runtimeStatePath, outputRoot } = buildPolicyAndRuntime(tempRoot);

    const code = `
import json
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
        return {"status": "failed", "reason": "target_mismatch_stop", "validation": {"validation": {"matched": False, "reason": "window_title_mismatch"}}}

    def execute_capture_screenshot(self, output_path):
        return {"status": "skipped", "reason": "not_run", "output_path": str(output_path)}

    def execute_send_text(self, *args, **kwargs):
        raise AssertionError("send must not run when target validation fails")

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: FakeAdapter(),
)
print(json.dumps(result))
`;

    const result = JSON.parse(runPythonCode(code));
    assert.equal(result.decision, 'target_mismatch_stop');
  });

  await t.test('composer echo mismatch surfaces send_not_confirmed', () => {
    const tempRoot = makeTempRoot('phase873-send-mismatch-');
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
                "visible_read": {"status": "executed", "payload_summary": {"items": []}},
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - Codex Self Test"}},
            },
        }

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake-image", encoding="utf-8")
        return {"status": "executed", "output_path": str(output_path)}

    def execute_send_text(self, message_text, **kwargs):
        return {
            "status": "failed",
            "reason": "send_not_confirmed",
            "result": {
                "status": "echo_mismatch",
                "send_method": None,
                "echoed_text": "別テキスト",
            },
        }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: FakeAdapter(),
)
print(json.dumps(result))
`;

    const result = JSON.parse(runPythonCode(code));
    assert.equal(result.decision, 'send_not_confirmed');
  });

  await t.test('reply timeout degrades to post_send_reply_missing without dropping the run', () => {
    const tempRoot = makeTempRoot('phase873-reply-gap-');
    t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));
    const { policyPath, runtimeStatePath, outputRoot } = buildPolicyAndRuntime(tempRoot);

    const code = `
import json
from pathlib import Path
from member_line_patrol import execute_harness as harness

class FakeAdapter:
    def __init__(self):
        self.validate_calls = 0

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
                "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "前回の確認です"}]}},
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - Codex Self Test"}},
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
            "result": {"status": "sent", "send_method": "button", "echoed_text": message_text},
        }

    def execute_validate_target(self, **kwargs):
        self.validate_calls += 1
        visible_items = [{"role": "unknown", "text": "前回の確認です"}]
        if self.validate_calls >= 1:
            visible_items = [
                {"role": "unknown", "text": "前回の確認です"},
                {"role": "unknown", "text": "実行メッセージ"},
            ]
        ax_output_path = kwargs.get("ax_output_path")
        visible_output_path = kwargs.get("visible_output_path")
        if ax_output_path:
            path_obj = Path(ax_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"window_name": "LINE - Codex Self Test"}), encoding="utf-8")
        if visible_output_path:
            path_obj = Path(visible_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"items": visible_items}), encoding="utf-8")
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "output_path": str(ax_output_path), "payload_summary": {"window_name": "LINE - Codex Self Test"}},
            "visible_read": {"status": "executed", "output_path": str(visible_output_path), "payload_summary": {"items": visible_items}},
            "validation": {"matched": True, "reason": "matched"},
        }

def fake_evaluate_runner(repo_root, trace_path, main_output_path, planning_output_path):
    Path(main_output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(main_output_path).write_text(json.dumps({
        "summary": {"overallStatus": "degraded", "status": "review_needed"},
        "planningStatus": "ready",
        "analysisStatus": "root_cause_identified",
        "observationStatus": "post_send_reply_missing",
        "reviewUnitCount": 1,
        "topPriorityCount": 1,
    }), encoding="utf-8")
    Path(planning_output_path).write_text(json.dumps({"recommendedPr": []}), encoding="utf-8")
    return {"ok": True, "mainOutputPath": str(Path(main_output_path).resolve()), "planningOutputPath": str(Path(planning_output_path).resolve())}

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: FakeAdapter(),
    evaluate_runner=fake_evaluate_runner,
)
print(json.dumps(result))
`;

    const result = JSON.parse(runPythonCode(code));
    assert.equal(result.decision, 'execute_evaluated');
    const trace = readJson(result.tracePath);
    assert.equal(trace.correlation_status, 'post_send_reply_missing');
  });
});
