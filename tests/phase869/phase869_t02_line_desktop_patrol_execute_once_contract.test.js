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

test('phase869: execute_once writes trace, eval, and queue artifacts after one bounded send', (t) => {
  const tempRoot = makeTempRoot('phase869-execute-once-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

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
                "ax_dump": {"status": "executed", "payload_summary": {"process_name": "LINE", "frontmost": True, "window_count": 1, "window_name": "LINE - Codex Self Test", "ui_elements_enabled": True}},
                "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "前回の確認です"}]}},
                "validation": {
                    "matched": True,
                    "reason": "matched",
                    "matched_signals": ["chat_title", "participant_labels"],
                    "required_identity_signals": 2,
                    "configured_identity_signals": 2,
                    "actual_ax_fingerprint": "fingerprint-1",
                },
            },
            "open_attempts": [],
        }

    def execute_capture_screenshot(self, output_path):
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("fake-image", encoding="utf-8")
        return {
            "status": "executed",
            "output_path": str(output_path),
            "result": {"status": "ok"},
        }

    def execute_send_text(self, message_text, **kwargs):
        return {
            "status": "executed",
            "reason": "sent",
            "result": {
                "status": "sent",
                "send_method": "button",
                "echoed_text": message_text,
            },
        }

    def execute_validate_target(self, **kwargs):
        self.validate_calls += 1
        visible_items = [{"role": "unknown", "text": "前回の確認です"}]
        if self.validate_calls >= 1:
            visible_items = [
                {"role": "unknown", "text": "前回の確認です"},
                {"role": "unknown", "text": "実行メッセージ"},
                {"role": "unknown", "text": "了解しました。次は設定を確認します。"},
            ]
        ax_output_path = kwargs.get("ax_output_path")
        visible_output_path = kwargs.get("visible_output_path")
        if ax_output_path:
            path_obj = Path(ax_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"process_name": "LINE", "frontmost": True, "window_count": 1, "window_name": "LINE - Codex Self Test", "ui_elements_enabled": True}), encoding="utf-8")
        if visible_output_path:
            path_obj = Path(visible_output_path)
            path_obj.parent.mkdir(parents=True, exist_ok=True)
            path_obj.write_text(json.dumps({"items": visible_items}), encoding="utf-8")
        return {
            "status": "executed",
            "ax_dump": {
                "status": "executed",
                "output_path": str(ax_output_path) if ax_output_path else None,
                "payload_summary": {"process_name": "LINE", "frontmost": True, "window_count": 1, "window_name": "LINE - Codex Self Test", "ui_elements_enabled": True},
            },
            "visible_read": {
                "status": "executed",
                "output_path": str(visible_output_path) if visible_output_path else None,
                "payload_summary": {"items": visible_items},
            },
            "validation": {
                "matched": True,
                "reason": "matched",
                "matched_signals": ["chat_title", "participant_labels"],
                "required_identity_signals": 2,
                "configured_identity_signals": 2,
                "actual_ax_fingerprint": "fingerprint-1",
            },
        }

def fake_evaluate_runner(repo_root, trace_path, main_output_path, planning_output_path):
    Path(main_output_path).parent.mkdir(parents=True, exist_ok=True)
    Path(main_output_path).write_text(json.dumps({
        "summary": {"overallStatus": "healthy", "headline": "execute run ok", "status": "ready"},
        "planningStatus": "ready",
        "analysisStatus": "root_cause_identified",
        "observationStatus": "reply_observed",
        "reviewUnitCount": 1,
        "topPriorityCount": 1,
        "recommendedPrCount": 1,
    }), encoding="utf-8")
    Path(planning_output_path).write_text(json.dumps({
        "recommendedPr": [
            {
                "proposalKey": "proposal_demo",
                "proposalType": "runtime_fix",
                "title": "Tighten execute loop wording",
                "objective": "Improve the patrol follow-up wording.",
                "whyNow": "The execute harness observed a stable reply.",
                "whyNotOthers": "This is the smallest safe change.",
                "rootCauseRefs": ["desktop_trace:runtime_fix"],
                "targetFiles": ["docs/LINE_DESKTOP_PATROL_ARCHITECTURE.md"],
                "expectedImpact": ["Clearer execute summary"],
                "rollbackPlan": ["Revert the draft PR"],
                "preconditions": ["Human review"],
                "blockedBy": [],
                "confidence": 0.71,
                "priority": "P2",
                "riskLevel": "medium",
            }
        ]
    }), encoding="utf-8")
    return {
        "ok": True,
        "mainOutputPath": str(Path(main_output_path).resolve()),
        "planningOutputPath": str(Path(planning_output_path).resolve()),
    }

def fake_enqueue_runner(**kwargs):
    queue_root = Path(kwargs["queue_root"])
    queue_root.mkdir(parents=True, exist_ok=True)
    return {
        "ok": True,
        "queuePath": str(queue_root / "queue.jsonl"),
        "linkagePath": str(Path(kwargs["trace_path"]).resolve().parent / "proposal_linkage.json"),
        "queuedCount": 1,
        "duplicateCount": 0,
        "queuedProposalIds": ["proposal_demo"],
        "duplicateProposalIds": [],
        "packetPaths": [str(queue_root / "packets" / "proposal_demo.codex.json")],
    }

result = harness.run_execute_harness(
    policy_path=${JSON.stringify(policyPath)},
    scenario_path=${JSON.stringify(path.join(path.resolve(__dirname, '..', '..'), 'tools', 'line_desktop_patrol', 'scenarios', 'smoke_dry_run.example.json'))},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    mode="execute_once",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    reply_wait_window_ms=0,
    message_text="実行メッセージ",
    adapter_factory=lambda: FakeAdapter(),
    evaluate_runner=fake_evaluate_runner,
    enqueue_runner=fake_enqueue_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const trace = readJson(result.tracePath);
  const latestSummary = readJson(result.latestSummaryPath);
  const state = readJson(result.statePath);

  assert.equal(result.allowed, true);
  assert.equal(result.decision, 'execute_queued');
  assert.equal(trace.send_result.result.status, 'sent');
  assert.equal(trace.correlation_status, 'reply_observed');
  assert.equal(trace.evaluator_scores.status, 'completed');
  assert.equal(trace.evaluator_scores.planningStatus, 'ready');
  assert.equal(trace.proposal_id, 'proposal_demo');
  assert.equal(latestSummary.proposal_id, 'proposal_demo');
  assert.equal(state.last_decision.decision, 'execute_queued');
});
