'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  makeTempRoot,
  readJson,
  runPythonCode,
  writeJson
} = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase905: acceptance gate excludes open_target runs from send KPIs and records diagnostics separately', (t) => {
  const tempRoot = makeTempRoot('phase905-acceptance-open-target-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputRoot = path.join(tempRoot, 'artifacts');
  const runsRoot = path.join(outputRoot, 'runs');
  const promotionsRoot = path.join(outputRoot, 'proposals', 'promotions');
  const manualReportPath = path.join(tempRoot, 'acceptance.manual.json');
  const outputPath = path.join(outputRoot, 'acceptance', 'latest.json');

  writeJson(path.join(runsRoot, 'ldp_open_target_00', 'trace.json'), {
    run_id: 'ldp_open_target_00',
    send_mode: 'open_target',
    send_attempted: false,
    failure_reason: 'open_target_mismatch_stop',
    target_validation: { matched: false, reason: 'insufficient_identity_signals' },
  });

  for (let index = 0; index < 10; index += 1) {
    const runId = `ldp_execute_${String(index).padStart(2, '0')}`;
    writeJson(path.join(runsRoot, runId, 'trace.json'), {
      run_id: runId,
      send_mode: 'execute_once',
      send_attempted: true,
      target_validation: {
        matched: true,
        reason: 'matched',
      },
      send_result: {
        result: {
          status: 'sent',
          echoed_text: `execute message ${index}`,
        },
      },
      correlation_status: index === 9 ? 'post_send_reply_missing' : 'reply_observed',
      screenshot_after: `/tmp/${runId}/after.png`,
      post_observation: {
        capture_screenshot: { status: 'executed', output_path: `/tmp/${runId}/after.png` },
        validate_target: { status: 'executed', validation: { matched: true, reason: 'matched' } },
      },
      visible_after: [
        { role: 'unknown', text: `execute message ${index}` },
        { role: 'unknown', text: `reply ${index}` },
      ],
    });
  }

  writeJson(path.join(promotionsRoot, 'proposal_demo.json'), {
    ok: true,
    proposal_id: 'proposal_demo',
    status: 'draft_pr_created',
    draft_pr_ref: 'https://github.com/parentyai/member/pull/9999',
  });
  writeJson(manualReportPath, {
    generated_at: '2026-03-27T01:00:00.000Z',
    accessibility_granted: true,
    screen_recording_granted: true,
    self_test_target_ready: true,
    execute_once_attempted: 10,
    execute_once_passed: 10,
    scheduled_execute_attempted: 50,
    scheduled_execute_passed: 50,
  });

  const code = `
import json
from member_line_patrol.acceptance_gate import run_acceptance_gate

result = run_acceptance_gate(
    output_root=${JSON.stringify(outputRoot)},
    manual_report_path=${JSON.stringify(manualReportPath)},
    output_path=${JSON.stringify(outputPath)},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const written = readJson(outputPath);

  assert.equal(result.overallStatus, 'ready');
  assert.equal(result.automatic.metrics.executeRunCount, 11);
  assert.equal(result.automatic.metrics.openTargetRunCount, 1);
  assert.equal(result.automatic.metrics.openTargetMismatchCount, 1);
  assert.equal(result.automatic.metrics.attemptedSendCount, 10);
  assert.equal(result.automatic.metrics.sentCount, 10);
  assert.equal(result.automatic.metrics.targetMismatchFalseNegativeCount, 0);
  assert.equal(written.automatic.metrics.openTargetMismatchCount, 1);
});

test('phase905: acceptance gate infers send_attempted for legacy traces that only recorded send_result', (t) => {
  const tempRoot = makeTempRoot('phase905-acceptance-legacy-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputRoot = path.join(tempRoot, 'artifacts');
  const runsRoot = path.join(outputRoot, 'runs');

  writeJson(path.join(runsRoot, 'ldp_legacy_00', 'trace.json'), {
    run_id: 'ldp_legacy_00',
    send_mode: 'execute_once',
    target_validation: {
      matched: true,
      reason: 'matched',
    },
    send_result: {
      result: {
        status: 'sent',
        echoed_text: 'legacy send',
      },
    },
    correlation_status: 'reply_observed',
    screenshot_after: '/tmp/legacy/after.png',
    post_observation: {
      capture_screenshot: { status: 'executed', output_path: '/tmp/legacy/after.png' },
      validate_target: { status: 'executed', validation: { matched: true, reason: 'matched' } },
    },
    visible_after: [
      { role: 'unknown', text: 'legacy send' },
      { role: 'unknown', text: 'legacy reply' },
    ],
  });

  const code = `
import json
from pathlib import Path
from member_line_patrol.acceptance_gate import _build_automatic_section, _discover_execute_traces

output_root = Path(${JSON.stringify(outputRoot)})
traces = _discover_execute_traces(output_root)
automatic = _build_automatic_section(traces, [])
print(json.dumps(automatic))
`;

  const automatic = JSON.parse(runPythonCode(code));
  assert.equal(automatic.metrics.executeRunCount, 1);
  assert.equal(automatic.metrics.attemptedSendCount, 1);
  assert.equal(automatic.metrics.sentCount, 1);
  assert.equal(automatic.metrics.openTargetRunCount, 0);
});

test('phase905: acceptance gate counts execute success from sibling result artifacts when trace.json is sparse', (t) => {
  const tempRoot = makeTempRoot('phase905-acceptance-result-bridge-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputRoot = path.join(tempRoot, 'artifacts');
  const runRoot = path.join(outputRoot, 'runs', 'line-patrol-result-bridge');
  const manualReportPath = path.join(tempRoot, 'acceptance.manual.json');
  const outputPath = path.join(outputRoot, 'acceptance', 'latest.json');

  writeJson(path.join(runRoot, 'trace.json'), {
    run_id: 'line-patrol-result-bridge',
    target_id: 'sample-self-test',
    sent_text: 'result bridge message',
    visible_before: [],
    visible_after: [],
  });
  writeJson(path.join(runRoot, 'result.json'), {
    ok: true,
    result: {
      mode: 'execute',
      targetMatchedHeuristic: true,
      replyObserved: true,
      visibleAfter: [
        { role: 'visible_text', text: '09:27 Arumamih$ result bridge message' },
        { role: 'visible_text', text: '09:27 メンバー result bridge reply' },
      ],
      evaluatorScores: {
        sentVisible: true,
        replyObserved: true,
      },
    },
  });
  writeJson(manualReportPath, {
    generated_at: '2026-03-28T14:00:00.000Z',
    accessibility_granted: true,
    screen_recording_granted: true,
    self_test_target_ready: true,
    execute_once_attempted: 10,
    execute_once_passed: 10,
    scheduled_execute_attempted: 50,
    scheduled_execute_passed: 50,
  });

  const code = `
import json
from member_line_patrol.acceptance_gate import run_acceptance_gate

result = run_acceptance_gate(
    output_root=${JSON.stringify(outputRoot)},
    manual_report_path=${JSON.stringify(manualReportPath)},
    output_path=${JSON.stringify(outputPath)},
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const written = readJson(outputPath);

  assert.equal(result.overallStatus, 'ready');
  assert.equal(result.automatic.metrics.executeRunCount, 1);
  assert.equal(result.automatic.metrics.attemptedSendCount, 1);
  assert.equal(result.automatic.metrics.validatedAttemptedSendCount, 1);
  assert.equal(result.automatic.metrics.sentCount, 1);
  assert.equal(result.automatic.metrics.successfulValidatedSendCount, 1);
  assert.equal(result.automatic.metrics.replyCorrelationUsableCount, 1);
  assert.equal(written.automatic.latestTracePath.endsWith('/trace.json'), true);
});
