'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase874: dump_ax_tree plan reads LINE window bounds through windowPosition/windowSize variables', () => {
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

adapter = MacOSLineDesktopAdapter(
    platform_system="Darwin",
    tool_lookup=lambda _: "/usr/bin/mock",
)
plan = adapter.plan_dump_ax_tree("/tmp/member_line_ax_bounds.json")
print(json.dumps(plan["command"]["argv"]))
`;

  const argv = JSON.parse(runPythonCode(code));
  assert.ok(argv.includes('if windowCount > 0 then set windowPosition to position of window 1 of targetProcess'));
  assert.ok(argv.includes('if windowCount > 0 then set windowSize to size of window 1 of targetProcess'));
  assert.ok(!argv.includes('if windowCount > 0 then set windowX to item 1 of position of window 1 of targetProcess'));
  assert.ok(!argv.includes('if windowCount > 0 then set windowWidth to item 1 of size of window 1 of targetProcess'));
});
