'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runPythonCode
} = require('../phase864/_line_desktop_patrol_ax_test_helper');

test('phase866: adapter executes bounded visible message read with injected macOS runner', (t) => {
  const tempRoot = makeTempRoot('phase866-visible-read-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputPath = path.join(tempRoot, 'visible_after.json');
  const code = `
import json
from types import SimpleNamespace
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

def runner(argv, check=False, capture_output=True, text=True, timeout=None):
    return SimpleNamespace(
        returncode=0,
        stdout="こんにちは||相談したいです||追加入力",
        stderr="",
    )

adapter = MacOSLineDesktopAdapter(
    command_runner=runner,
    platform_system="Darwin",
    platform_release="24.0",
    tool_lookup=lambda name: f"/usr/bin/{name}",
)
result = adapter.execute_read_visible_messages(${JSON.stringify(outputPath)}, target_process_name="LINE", max_items=2, timeout_seconds=1.5)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const payload = readJson(outputPath);

  assert.equal(result.status, 'executed');
  assert.equal(result.plan.max_items, 2);
  assert.equal(result.payload_summary.item_count, 2);
  assert.equal(payload.item_count, 2);
  assert.equal(payload.truncated, true);
  assert.deepEqual(payload.items.map((item) => item.text), ['こんにちは', '相談したいです']);
  assert.deepEqual(payload.items.map((item) => item.role), ['unknown', 'unknown']);
});
