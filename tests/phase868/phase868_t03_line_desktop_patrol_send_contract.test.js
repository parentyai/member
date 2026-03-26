'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase868: execute_send_text confirms composer echo before reporting success', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Completed:
    def __init__(self, returncode=0, stdout="", stderr=""):
        self.returncode = returncode
        self.stdout = stdout
        self.stderr = stderr

def fake_runner(argv, check=False, capture_output=True, text=True, timeout=None):
    return Completed(returncode=0, stdout="sent||button||実行メッセージ")

adapter = MacOSLineDesktopAdapter(
    command_runner=fake_runner,
    platform_system="Darwin",
    tool_lookup=lambda _: "/usr/bin/mock",
)
result = adapter.execute_send_text(
    "実行メッセージ",
    expected_chat_title="Codex Self Test",
    expected_window_title_substring="LINE",
    expected_participant_labels=("Self Test",),
    existing_validation={"validation": {"matched": True, "reason": "matched"}},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'executed');
  assert.equal(result.reason, 'sent');
  assert.equal(result.result.status, 'sent');
  assert.equal(result.result.send_method, 'button');
  assert.equal(result.result.echoed_text, '実行メッセージ');
});
