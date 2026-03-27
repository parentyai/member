'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase874: load_policy accepts an allowed target with an empty participant label list', () => {
  const code = `
import json
import tempfile
from pathlib import Path

from member_line_patrol.policy import load_policy

payload = {
    "enabled": True,
    "dry_run_default": False,
    "allowed_targets": [{
        "alias": "member-self-test",
        "platform": "line_desktop",
        "target_kind": "single_user",
        "expected_chat_title": "メンバー",
        "expected_window_title_substring": "LINE",
        "expected_participant_labels": [],
        "expected_ax_fingerprint": None,
        "allowed_send_modes": ["execute"],
        "notes": "test",
    }],
    "blocked_hours": [],
    "max_runs_per_hour": 2,
    "failure_streak_threshold": 3,
    "ui_drift_threshold": 0.15,
    "require_target_confirmation": True,
    "store_screenshots": True,
    "store_ax_tree": True,
    "proposal_mode": "local_queue",
    "auto_apply_level": "none",
}

with tempfile.TemporaryDirectory() as tmpdir:
    path = Path(tmpdir) / "policy.json"
    path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
    policy = load_policy(path)
    print(json.dumps({
        "alias": policy.allowed_targets[0].alias,
        "participants": list(policy.allowed_targets[0].expected_participant_labels),
    }, ensure_ascii=False))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.alias, 'member-self-test');
  assert.deepEqual(result.participants, []);
});
