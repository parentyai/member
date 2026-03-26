'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode, writePolicy, writeRuntimeStateFixture } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase872: execute loop selects a scenario by scenario_id and forwards execute_once result', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase872-execute-loop-select-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const policyPath = path.join(tempRoot, 'policy.json');
  const outputRoot = path.join(tempRoot, 'artifacts');
  const runtimeStatePath = path.join(tempRoot, 'runtime_state.json');
  const scenarioDir = path.join(tempRoot, 'scenarios');
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
    scenario_id: 'smoke_execute',
    intent: 'smoke_patrol',
    user_input: 'A',
    expected_behavior: ['target_validated'],
    expected_routing: ['desktop_patrol'],
    forbidden_patterns: ['send_without_confirmation'],
    timeout_budget: { open_target_seconds: 30, observe_seconds: 20 },
    retry_policy: { max_attempts: 1, backoff_seconds: 0 }
  }, null, 2));
  fs.writeFileSync(path.join(scenarioDir, 'b.json'), JSON.stringify({
    scenario_id: 'followup_execute',
    intent: 'followup_patrol',
    user_input: 'B',
    expected_behavior: ['target_validated'],
    expected_routing: ['desktop_patrol', 'follow-up'],
    forbidden_patterns: ['send_without_confirmation'],
    timeout_budget: { open_target_seconds: 30, observe_seconds: 20 },
    retry_policy: { max_attempts: 1, backoff_seconds: 0 }
  }, null, 2));

  const code = `
import json
from member_line_patrol import execute_loop

def fake_runner(**kwargs):
    return {
        "ok": True,
        "allowed": True,
        "decision": "execute_queued",
        "tracePath": "/tmp/mock-trace.json",
        "statePath": "/tmp/mock-state.json",
        "latestSummaryPath": "/tmp/mock-summary.json",
    }

execute_loop.run_execute_harness = fake_runner
result = execute_loop.run_execute_loop(
    policy_path=${JSON.stringify(policyPath)},
    output_root=${JSON.stringify(outputRoot)},
    route_key="line-desktop-patrol",
    scenario_dir=${JSON.stringify(scenarioDir)},
    scenario_id="followup_execute",
    runtime_state_path=${JSON.stringify(runtimeStatePath)},
    now_iso="2026-03-26T08:10:00.000Z",
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.mode, 'execute_loop');
  assert.ok(result.selectedScenarioPath.endsWith('/b.json'));
  assert.equal(result.result.decision, 'execute_queued');
});
