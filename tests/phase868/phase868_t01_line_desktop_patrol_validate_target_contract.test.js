'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase868: validate_target_observation fails closed when confirmation signals are insufficient', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

adapter = MacOSLineDesktopAdapter()
result = adapter.validate_target_observation(
    expected_chat_title="Codex Self Test",
    expected_window_title_substring="LINE",
    expected_participant_labels=["Different Person"],
    expected_ax_fingerprint=None,
    ax_payload={
        "process_name": "LINE",
        "frontmost": True,
        "window_count": 1,
        "window_name": "LINE - Codex Self Test",
        "ui_elements_enabled": True,
    },
    visible_payload={
        "items": [
            {"role": "unknown", "text": "Codex Self Test"},
            {"role": "unknown", "text": "前回のメモです"},
        ],
    },
    require_confirmation=True,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.matched, false);
  assert.equal(result.reason, 'insufficient_identity_signals');
  assert.equal(result.required_identity_signals, 2);
  assert.deepEqual(result.matched_signals, ['chat_title']);
});
