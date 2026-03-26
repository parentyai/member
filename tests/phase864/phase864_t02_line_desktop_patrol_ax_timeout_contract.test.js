'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  runPythonCode
} = require('./_line_desktop_patrol_ax_test_helper');

test('phase864: adapter degrades to ax_timeout when System Events hangs', (t) => {
  const tempRoot = makeTempRoot('phase864-ax-timeout-');
  t.after(() => require('node:fs').rmSync(tempRoot, { recursive: true, force: true }));

  const code = `
import json
import subprocess
from member_line_patrol.macos_adapter import MacOSLineDesktopAdapter

def runner(argv, check=False, capture_output=True, text=True, timeout=None):
    raise subprocess.TimeoutExpired(cmd=argv, timeout=timeout)

adapter = MacOSLineDesktopAdapter(
    command_runner=runner,
    platform_system="Darwin",
    platform_release="24.0",
    tool_lookup=lambda name: f"/usr/bin/{name}",
)
result = adapter.execute_dump_ax_tree(${JSON.stringify(tempRoot + '/after.ax.json')}, target_process_name="LINE", timeout_seconds=1.5)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'skipped');
  assert.equal(result.reason, 'ax_timeout');
  assert.equal(result.timeout_seconds, 1.5);
  assert.equal(result.plan.timeout_seconds, 1.5);
});
