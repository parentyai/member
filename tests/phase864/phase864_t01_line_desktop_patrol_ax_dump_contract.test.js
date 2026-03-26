'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runPythonCode
} = require('./_line_desktop_patrol_ax_test_helper');

test('phase864: adapter executes bounded AX summary dump with injected macOS runner', (t) => {
  const tempRoot = makeTempRoot('phase864-ax-dump-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputPath = path.join(tempRoot, 'after.ax.json');
  const code = `
import json
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Completed:
    def __init__(self):
        self.returncode = 0
        self.stdout = "LINE||true||1||Codex Self Test||true"
        self.stderr = ""

def runner(argv, check=False, capture_output=True, text=True, timeout=None):
    return Completed()

adapter = MacOSLineDesktopAdapter(
    command_runner=runner,
    platform_system="Darwin",
    platform_release="24.0",
    tool_lookup=lambda name: f"/usr/bin/{name}",
)
result = adapter.execute_dump_ax_tree(${JSON.stringify(outputPath)}, target_process_name="LINE", timeout_seconds=1.5)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'executed');
  assert.equal(result.result.status, 'ok');
  assert.equal(result.file_exists, true);
  assert.equal(result.payload_summary.process_name, 'LINE');
  assert.equal(result.payload_summary.window_count, 1);
  assert.ok(fs.existsSync(outputPath));

  const payload = readJson(outputPath);
  assert.equal(payload.window_name, 'Codex Self Test');
  assert.equal(payload.ui_elements_enabled, true);
});
