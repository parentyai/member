'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode, writePolicy, writeRuntimeStateFixture } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase872: execute loop skips when an active lock already exists', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase872-execute-loop-lock-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const scenarioDir = path.join(tempRoot, 'scenarios');
  fs.mkdirSync(path.join(outputRoot, 'runtime'), { recursive: true });
  fs.mkdirSync(scenarioDir, { recursive: true });

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
  fs.writeFileSync(path.join(scenarioDir, 'a.json'), JSON.stringify({
    scenario_id: 'execute_smoke',
    intent: 'smoke_patrol',
    user_input: '確認メッセージです',
    expected_behavior: ['target_validated'],
    expected_routing: ['desktop_patrol'],
    forbidden_patterns: ['send_without_confirmation'],
    timeout_budget: { open_target_seconds: 30, observe_seconds: 20 },
    retry_policy: { max_attempts: 1, backoff_seconds: 0 }
  }, null, 2));
  fs.writeFileSync(path.join(outputRoot, 'runtime', 'execute.lock.json'), JSON.stringify({
    lock_id: 'lock_active',
    issued_at: '2026-03-26T08:00:00.000Z',
    pid: 100
  }, null, 2));

  const code = `
import json
from member_line_patrol.execute_loop import run_execute_loop

result = run_execute_loop(
    policy_path=${JSON.stringify(policyPath)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    scenario_dir=${JSON.stringify(scenarioDir)},
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    now_iso="2026-03-26T08:10:00.000Z",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.allowed, false);
  assert.equal(result.decision, 'overlap_run_skip');
});
