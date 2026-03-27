'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase875: execute_send_text tolerates bounded OCR punctuation noise before pressing return fallback', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Completed:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr

def fake_runner(argv, check=False, capture_output=True, text=True, timeout=None, input=None):
    return Completed(returncode=0, stdout="composer_missing||none||")

class Adapter(MacOSLineDesktopAdapter):
    def execute_paste_composer_text(self, *args, **kwargs):
        return {"status": "executed"}

    def execute_capture_window_region(self, *args, **kwargs):
        return {"status": "executed", "output_path": "/tmp/member_line_composer_fallback_noise.png"}

    def execute_ocr_window_title(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "items": [
                    {"role": "ocr_window_header", "text": "Codex LINE Desktop execute _loop soak 01 1774575632|"},
                    {"role": "ocr_window_header", "text": "5:58 PM"},
                ],
            },
        }

    def execute_press_return_key(self, *args, **kwargs):
        return {"status": "executed"}

adapter = Adapter(
    command_runner=fake_runner,
    platform_system="Darwin",
    tool_lookup=lambda _: "/usr/bin/mock",
)
result = adapter.execute_send_text(
    "Codex LINE Desktop execute_loop soak 01 1774575632",
    expected_chat_title="メンバー",
    expected_window_title_substring="LINE",
    expected_participant_labels=(),
    existing_validation={
        "validation": {"matched": True, "reason": "matched"},
        "ax_dump": {
            "payload_summary": {
                "window_bounds": {"x": 80, "y": 25, "width": 1459, "height": 1390},
            },
        },
    },
)
print(json.dumps(result, ensure_ascii=False))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'executed');
  assert.equal(result.reason, 'sent');
  assert.equal(result.result.status, 'sent');
  assert.equal(result.result.send_method, 'return_fallback');
  assert.equal(result.result.echoed_text, 'Codex LINE Desktop execute _loop soak 01 1774575632|');
});
