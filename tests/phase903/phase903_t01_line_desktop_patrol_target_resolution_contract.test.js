'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase903: execute_validate_target retries OCR once after timeout and matches on the second pass', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Adapter(MacOSLineDesktopAdapter):
    def __init__(self):
        super().__init__(platform_system="Darwin", tool_lookup=lambda _: "/usr/bin/mock")
        self.ocr_calls = 0

    def execute_dump_ax_tree(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "process_name": "LINE",
                "frontmost": True,
                "window_count": 1,
                "window_name": "LINE",
                "ui_elements_enabled": True,
                "window_bounds": {"x": 40, "y": 20, "width": 900, "height": 780},
            },
        }

    def execute_read_visible_messages(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {"items": []},
        }

    def execute_capture_window_region(self, output_path, *, bounds):
        return {
            "status": "executed",
            "output_path": str(output_path),
            "bounds": bounds,
            "result": {"status": "ok"},
        }

    def execute_ocr_window_title(self, *args, **kwargs):
        self.ocr_calls += 1
        if self.ocr_calls == 1:
            return {
                "status": "skipped",
                "reason": "ocr_timeout",
                "image_path": "/tmp/ocr-primary.png",
            }
        return {
            "status": "executed",
            "payload_summary": {
                "items": [
                    {"role": "ocr_window_header", "text": "メンバー"},
                ],
            },
        }

adapter = Adapter()
result = adapter.execute_validate_target(
    expected_chat_title="メンバー",
    expected_window_title_substring="LINE",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.validation.matched, true);
  assert.equal(result.validation.reason, 'matched');
  assert.deepEqual(result.target_resolution.resolution_path, ['ax_visible', 'ocr_primary', 'ocr_primary_retry']);
  assert.equal(result.target_resolution.ocr_attempt_count, 2);
  assert.equal(result.target_resolution.ocr_title_status, 'executed');
  assert.equal(result.validation.generic_shell_detected, false);
});

test('phase903: execute_validate_target records the bounded fallback order and sidebar evidence before fail-closed stop', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Adapter(MacOSLineDesktopAdapter):
    def __init__(self):
        super().__init__(platform_system="Darwin", tool_lookup=lambda _: "/usr/bin/mock")
        self.ocr_calls = 0

    def execute_dump_ax_tree(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {
                "process_name": "LINE",
                "frontmost": True,
                "window_count": 1,
                "window_name": "LINE",
                "ui_elements_enabled": True,
                "window_bounds": {"x": 30, "y": 10, "width": 1024, "height": 820},
            },
        }

    def execute_read_visible_messages(self, *args, **kwargs):
        return {
            "status": "executed",
            "payload_summary": {"items": []},
        }

    def execute_capture_window_region(self, output_path, *, bounds):
        return {
            "status": "executed",
            "output_path": str(output_path),
            "bounds": bounds,
            "result": {"status": "ok"},
        }

    def execute_ocr_window_title(self, image_path, *args, **kwargs):
        self.ocr_calls += 1
        if self.ocr_calls in (1, 3):
            return {
                "status": "skipped",
                "reason": "ocr_timeout",
                "image_path": str(image_path),
            }
        if self.ocr_calls in (2, 4):
            return {
                "status": "executed",
                "payload_summary": {"items": []},
                "image_path": str(image_path),
            }
        return {
            "status": "executed",
            "payload_summary": {
                "items": [
                    {"role": "ocr_window_header", "text": "メンバー"},
                    {"role": "ocr_window_header", "text": "検索"},
                ],
            },
            "image_path": str(image_path),
        }

adapter = Adapter()
result = adapter.execute_validate_target(
    expected_chat_title="対象外",
    expected_window_title_substring="LINE",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.validation.matched, false);
  assert.equal(result.validation.reason, 'insufficient_identity_signals');
  assert.deepEqual(result.target_resolution.resolution_path, [
    'ax_visible',
    'ocr_primary',
    'ocr_primary_retry',
    'ocr_wide_header',
    'ocr_wide_header_retry',
    'ocr_sidebar'
  ]);
  assert.equal(result.target_resolution.ocr_attempt_count, 4);
  assert.equal(result.validation.generic_shell_detected, true);
  assert.equal(result.validation.ocr_sidebar_item_count, 2);
  assert.deepEqual(result.validation.ocr_sidebar_items_sample, ['メンバー', '検索']);
});

test('phase903: execute_open_test_chat can use the sidebar OCR fallback and revalidate before success', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Adapter(MacOSLineDesktopAdapter):
    def __init__(self):
        super().__init__(platform_system="Darwin", tool_lookup=lambda _: "/usr/bin/mock")
        self.validation_calls = 0

    def execute_prepare_line_app(self, target_alias=None):
        return {"status": "executed", "target_alias": target_alias}

    def execute_validate_target(self, **kwargs):
        self.validation_calls += 1
        if self.validation_calls == 1:
            return {
                "status": "executed",
                "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE", "frontmost": True, "window_count": 1, "process_name": "LINE"}},
                "visible_read": {"status": "executed", "payload_summary": {"items": []}},
                "ocr_title_read": {"status": "skipped", "reason": "ocr_timeout"},
                "ocr_sidebar_read": {
                    "status": "executed",
                    "payload_summary": {
                        "items": [
                            {"role": "ocr_window_header", "text": "メンバー"},
                            {"role": "ocr_window_header", "text": "検索"},
                        ],
                    },
                    "capture": {
                        "bounds": {"x": 20, "y": 40, "width": 240, "height": 640},
                    },
                },
                "target_resolution": {
                    "resolution_path": ["ax_visible", "ocr_primary", "ocr_primary_retry", "ocr_wide_header", "ocr_wide_header_retry", "ocr_sidebar"],
                    "ocr_title_reason": "ocr_timeout",
                },
                "validation": {
                    "matched": False,
                    "reason": "insufficient_identity_signals",
                    "frontmost": True,
                    "window_title_ok": True,
                    "generic_shell_detected": True,
                    "target_resolution": {
                        "ocr_title_reason": "ocr_timeout",
                    },
                },
            }
        return {
            "status": "executed",
            "ax_dump": {"status": "executed", "payload_summary": {"window_name": "LINE - メンバー", "frontmost": True, "window_count": 1, "process_name": "LINE"}},
            "visible_read": {"status": "executed", "payload_summary": {"items": [{"role": "unknown", "text": "メンバー"}]}},
            "validation": {
                "matched": True,
                "reason": "matched",
                "frontmost": True,
                "window_title_ok": True,
                "matched_signals": ["chat_title"],
            },
        }

    def _execute_click_target_candidate(self, candidate_text, **kwargs):
        return {
            "status": "executed",
            "method": "ax_contents",
            "candidate_text": candidate_text,
            "ocr_match_status": "not_used",
            "result": {
                "status": "no_match",
                "clicked_label": None,
            },
        }

    def execute_click_screen_point(self, *, x, y, timeout_seconds=0):
        return {
            "status": "executed",
            "point": {"x": x, "y": y},
            "result": {"status": "clicked"},
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
  assert.equal(result.status, 'executed');
  assert.equal(result.reason, 'opened');
  assert.equal(result.validation.validation.matched, true);
  assert.equal(result.open_attempts.length, 2);
  assert.equal(result.open_attempts[1].method, 'ocr_sidebar');
  assert.equal(result.open_attempts[1].ocr_match_status, 'unique_match');
});
