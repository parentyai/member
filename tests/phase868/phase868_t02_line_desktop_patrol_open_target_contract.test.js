'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase868: execute_open_test_chat opens a unique candidate and revalidates before success', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class FakeAdapter(MacOSLineDesktopAdapter):
    def __init__(self):
        super().__init__(platform_system="Darwin", tool_lookup=lambda _: "/usr/bin/mock")
        self.validation_calls = 0

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

    def execute_prepare_line_app(self, target_alias=None):
        return {"status": "executed", "target_alias": target_alias}

    def execute_validate_target(self, **kwargs):
        self.validation_calls += 1
        matched = self.validation_calls >= 2
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - Codex Self Test", "frontmost": True, "window_count": 1, "process_name": "LINE"}},
            "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "Codex Self Test"}]}},
            "validation": {
                "matched": matched,
                "reason": "matched" if matched else "insufficient_identity_signals",
                "matched_signals": ["chat_title"] if matched else [],
            },
        }

    def _execute_click_target_candidate(self, candidate_text, **kwargs):
        return {
            "status": "executed",
            "result": {
                "status": "clicked",
                "clicked_label": candidate_text,
            },
        }

adapter = FakeAdapter()
result = adapter.execute_open_test_chat(
    target_alias="sample-self-test",
    expected_chat_title="Codex Self Test",
    expected_window_title_substring="LINE",
    expected_participant_labels=("Self Test",),
    require_confirmation=True,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'executed');
  assert.equal(result.reason, 'opened');
  assert.equal(result.open_attempts.length, 1);
  assert.equal(result.open_attempts[0].result.status, 'clicked');
  assert.equal(result.validation.validation.matched, true);
});
