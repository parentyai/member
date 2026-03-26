'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  runPythonCode
} = require('./_line_desktop_patrol_screenshot_test_helper');

test('phase863: adapter executes bounded screenshot capture with injected macOS runner', (t) => {
  const tempRoot = makeTempRoot('phase863-capture-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputPath = path.join(tempRoot, 'after.png');
  const code = `
import json
from pathlib import Path
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

class Completed:
    def __init__(self):
        self.returncode = 0
        self.stdout = ""
        self.stderr = ""

def runner(argv, check=False, capture_output=True, text=True):
    output_path = Path(argv[-1])
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("fake screenshot bytes", encoding="utf-8")
    return Completed()

adapter = MacOSLineDesktopAdapter(
    command_runner=runner,
    platform_system="Darwin",
    platform_release="24.0",
    tool_lookup=lambda name: f"/usr/bin/{name}",
)
result = adapter.execute_capture_screenshot(${JSON.stringify(outputPath)})
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'executed');
  assert.equal(result.result.status, 'ok');
  assert.equal(result.file_exists, true);
  assert.equal(result.output_path, outputPath);
  assert.ok(fs.existsSync(outputPath));
});
