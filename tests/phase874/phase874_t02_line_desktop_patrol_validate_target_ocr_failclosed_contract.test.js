'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase874: execute_validate_target fails closed when OCR fallback cannot find the expected chat title', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Adapter(MacOSLineDesktopAdapter):
    def execute_dump_ax_tree(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "process_name": "LINE",
                "frontmost": True,
                "window_count": 1,
                "window_name": "LINE",
                "ui_elements_enabled": True,
                "window_bounds": {"x": 80, "y": 25, "width": 1459, "height": 1390},
            },
        }

    def execute_read_visible_messages(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "items": [],
            },
        }

    def execute_capture_window_region(self, *args, **kwargs):
        return {
            "status": "executed",
            "output_path": "/tmp/member_line_header_ocr.png",
            "result": {"status": "ok"},
        }

    def execute_ocr_window_title(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "items": [
                    {"role": "ocr_window_header", "text": "検索"},
                ],
            },
        }

adapter = Adapter(
    platform_system="Darwin",
    tool_lookup=lambda _: "/usr/bin/mock",
)
result = adapter.execute_validate_target(
    expected_chat_title="メンバー",
    expected_window_title_substring="LINE",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.validation.matched, false);
  assert.equal(result.validation.reason, 'insufficient_identity_signals');
  assert.equal(result.validation.frontmost, true);
  assert.equal(result.ocr_title_read.status, 'executed');
});
