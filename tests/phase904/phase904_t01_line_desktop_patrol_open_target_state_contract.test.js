'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runPythonCode,
  writeLoopState,
  writePolicy,
  writeRuntimeStateFixture
} = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

const ROOT = path.resolve(__dirname, '..', '..');
const SCENARIO_PATH = path.join(ROOT, 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json');

test('phase904: open_target does not attempt click fallback when LINE is not frontmost', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Adapter(MacOSLineDesktopAdapter):
    def __init__(self):
        super().__init__(platform_system="Darwin", tool_lookup=lambda _: "/usr/bin/mock")

    def execute_prepare_line_app(self, target_alias=None):
        return {"status": "executed", "target_alias": target_alias}

    def execute_validate_target(self, **kwargs):
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE", "frontmost": False, "window_count": 1, "process_name": "LINE"}},
            "visible_read": {"status": "executed", "payload_summary": {"items": []}},
            "validation": {
                "matched": False,
                "reason": "not_frontmost",
                "frontmost": False,
                "window_title_ok": True,
            },
        }

adapter = Adapter()
result = adapter.execute_open_test_chat(
    target_alias="member-self-test",
    expected_chat_title="メンバー",
    expected_window_title_substring="LINE",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'failed');
  assert.equal(result.reason, 'target_mismatch_stop');
  assert.deepEqual(result.open_attempts, []);
});

test('phase904: open_target_mismatch_stop preserves failure streak and does not count toward the hourly cap', (t) => {
  const tempRoot = makeTempRoot('phase904-open-target-mismatch-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRoot = path.join(tempRoot, 'artifacts');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    allowed_targets: [
      {
        alias: 'member-self-test',
        platform: 'line_desktop',
        target_kind: 'single_user',
        expected_chat_title: 'メンバー',
        expected_window_title_substring: 'LINE',
        expected_participant_labels: [],
        expected_ax_fingerprint: null,
        allowed_send_modes: ['execute'],
        notes: 'member-only self test',
      }
    ]
  });
  writeRuntimeStateFixture(runtimeStatePath);
  writeLoopState(outputRoot, {
    updated_at: '2026-03-27T22:00:00.000Z',
    failure_streak: 2,
    last_run_id: 'run_prev',
    last_failure_reason: 'target_mismatch_stop',
    recent_runs: [],
    last_decision: {
      decision: 'target_mismatch_stop',
      allowed: true,
      send_attempted: true,
      counted_towards_hourly_cap: true,
      at: '2026-03-27T22:00:05.000Z',
      target_id: 'member-self-test',
      run_id: 'run_prev',
      note: 'fixture',
    },
  });

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

    def execute_capture_screenshot(self, output_path):
        return {"status": "executed", "output_path": str(output_path), "result": {"status": "ok"}}

    def execute_open_test_chat(self, **kwargs):
        return {
            "status": "skipped",
            "reason": "target_mismatch_stop",
            "validation": {
                "status": "executed",
                "validation": {
                    "matched": False,
                    "reason": "insufficient_identity_signals",
                    "frontmost": True,
                    "window_title_ok": True,
                },
                "target_resolution": {
                    "resolution_path": ["ax_visible", "ocr_primary", "ocr_primary_retry"],
                    "ocr_title_reason": "ocr_timeout",
                },
            },
            "open_attempts": [],
        }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="open_target",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    adapter_factory=lambda: FakeAdapter(),
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const state = readJson(result.statePath);
  const latestSummary = readJson(result.latestSummaryPath);

  assert.equal(result.decision, 'open_target_mismatch_stop');
  assert.equal(state.failure_streak, 2);
  assert.equal(state.last_decision.decision, 'open_target_mismatch_stop');
  assert.equal(state.last_decision.send_attempted, false);
  assert.equal(state.last_decision.counted_towards_hourly_cap, false);
  assert.equal(latestSummary.send_attempted, false);
});

test('phase904: open_target_ready also preserves failure streak, while execute_once records send_attempted and hourly-cap usage', (t) => {
  const tempRoot = makeTempRoot('phase904-open-target-ready-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const outputRootReady = path.join(tempRoot, 'artifacts-ready');
  const outputRootExecute = path.join(tempRoot, 'artifacts-execute');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    allowed_targets: [
      {
        alias: 'member-self-test',
        platform: 'line_desktop',
        target_kind: 'single_user',
        expected_chat_title: 'メンバー',
        expected_window_title_substring: 'LINE',
        expected_participant_labels: [],
        expected_ax_fingerprint: null,
        allowed_send_modes: ['execute'],
        notes: 'member-only self test',
      }
    ]
  });
  writeRuntimeStateFixture(runtimeStatePath);
  writeLoopState(outputRootReady, {
    updated_at: '2026-03-27T22:10:00.000Z',
    failure_streak: 2,
    last_run_id: 'run_prev_ready',
    last_failure_reason: 'target_mismatch_stop',
    recent_runs: [],
    last_decision: {
      decision: 'target_mismatch_stop',
      allowed: true,
      send_attempted: true,
      counted_towards_hourly_cap: true,
      at: '2026-03-27T22:10:05.000Z',
      target_id: 'member-self-test',
      run_id: 'run_prev_ready',
      note: 'fixture',
    },
  });

  const readyCode = `
import json
from member_line_patrol import execute_harness as harness

class ReadyAdapter:
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

    def execute_capture_screenshot(self, output_path):
        return {"status": "executed", "output_path": str(output_path), "result": {"status": "ok"}}

    def execute_open_test_chat(self, **kwargs):
        return {
            "status": "executed",
            "reason": "opened",
            "validation": {
                "status": "executed",
                "validation": {
                    "matched": True,
                    "reason": "matched",
                    "frontmost": True,
                    "window_title_ok": True,
                },
                "target_resolution": {
                    "resolution_path": ["ax_visible"],
                    "ocr_title_reason": None,
                },
            },
            "open_attempts": [],
        }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRootReady)},
    route_key="line-desktop-patrol",
    mode="open_target",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    adapter_factory=lambda: ReadyAdapter(),
)
print(json.dumps(result))
`;

  const readyResult = JSON.parse(runPythonCode(readyCode));
  const readyState = readJson(readyResult.statePath);
  assert.equal(readyResult.decision, 'open_target_ready');
  assert.equal(readyState.failure_streak, 2);
  assert.equal(readyState.last_decision.send_attempted, false);
  assert.equal(readyState.last_decision.counted_towards_hourly_cap, false);

  const executeCode = `
import json
from pathlib import Path
from member_line_patrol import execute_harness as harness

class ExecuteAdapter:
    def __init__(self):
        self.validate_calls = 0

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

    def execute_open_test_chat(self, **kwargs):
        return {
            "status": "executed",
            "reason": "opened",
            "validation": {
                "status": "executed",
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - メンバー", "frontmost": True, "window_count": 1, "process_name": "LINE"}},
                "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "前回の確認です"}]}},
                "validation": {
                    "matched": True,
                    "reason": "matched",
                    "frontmost": True,
                    "window_title_ok": True,
                },
                "target_resolution": {"resolution_path": ["ax_visible"]},
            },
            "open_attempts": [],
        }

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake-image", encoding="utf-8")
        return {"status": "executed", "output_path": str(output_path), "result": {"status": "ok"}}

    def execute_send_text(self, message_text, **kwargs):
        return {"status": "executed", "reason": "sent", "result": {"status": "sent", "echoed_text": message_text}}

    def execute_validate_target(self, **kwargs):
        self.validate_calls += 1
        visible_items = [
            {"role": "unknown", "text": "前回の確認です"},
            {"role": "unknown", "text": "実行メッセージ"},
            {"role": "unknown", "text": "了解しました"},
        ]
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - メンバー", "frontmost": True, "window_count": 1, "process_name": "LINE"}},
            "visible_read": {"status": "executed", "payload_summary": {"items": visible_items}},
            "validation": {"matched": True, "reason": "matched"},
        }

def fake_evaluate_runner(repo_root, trace_path, main_output_path, planning_output_path):
    Path(main_output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(main_output_path).write_text(json.dumps({
        "summary": {"overallStatus": "healthy"},
        "planningStatus": "ready",
        "analysisStatus": "root_cause_identified",
        "observationStatus": "reply_observed",
        "reviewUnitCount": 1,
        "topPriorityCount": 1,
    }), encoding="utf-8")
    Path(planning_output_path).write_text(json.dumps({"recommendedPr": []}), encoding="utf-8")
    return {"ok": True, "mainOutputPath": str(Path(main_output_path).resolve()), "planningOutputPath": str(Path(planning_output_path).resolve())}

def fake_enqueue_runner(**kwargs):
    return {"ok": True, "queuedCount": 0, "duplicateCount": 0, "queuedProposalIds": [], "duplicateProposalIds": []}

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(SCENARIO_PATH)},
    output_root=${JSON.stringify(outputRootExecute)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: ExecuteAdapter(),
    evaluate_runner=fake_evaluate_runner,
    enqueue_runner=fake_enqueue_runner,
)
print(json.dumps(result))
`;

  const executeResult = JSON.parse(runPythonCode(executeCode));
  const executeState = readJson(executeResult.statePath);
  const executeTrace = readJson(executeResult.tracePath);
  const latestSummary = readJson(executeResult.latestSummaryPath);

  assert.equal(executeState.last_decision.send_attempted, true);
  assert.equal(executeState.last_decision.counted_towards_hourly_cap, true);
  assert.equal(executeTrace.send_attempted, true);
  assert.equal(latestSummary.send_attempted, true);
});
