'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode, writePolicy, writeRuntimeStateFixture } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase871: doctor reports execute-capable allowlist count and latest summary visibility', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase871-doctor-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const latestSummaryPath = path.join(tempRoot, 'latest_summary.json');

  writePolicy(policyPath, {
    enabled: true,
    blocked_hours: [],
    allowed_targets: [
      {
        alias: 'sample-self-test',
        platform: 'line_desktop',
        target_kind: 'single_user',
        expected_chat_title: 'Codex Self Test',
        expected_window_title_substring: 'LINE',
        expected_participant_labels: ['Self Test'],
        expected_ax_fingerprint: null,
        allowed_send_modes: ['execute'],
        notes: 'execute target'
      }
    ]
  });
  writeRuntimeStateFixture(runtimeStatePath);
  fs.writeFileSync(latestSummaryPath, JSON.stringify({ ok: true, decision: 'execute_queued' }, null, 2));

  const code = `
import json
from member_line_patrol.doctor import run_doctor

result = run_doctor(
    policy_path=${JSON.stringify(policyPath)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    latest_summary_path=${JSON.stringify(latestSummaryPath)},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.ok, true);
  assert.equal(result.policy.executeCapableAliases.length, 1);
  assert.equal(result.diagnostics.executeCapableTargetCount, 1);
  assert.equal(result.diagnostics.latestSummaryPresent, true);
});
