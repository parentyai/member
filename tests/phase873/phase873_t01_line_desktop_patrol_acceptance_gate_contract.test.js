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

test('phase873: acceptance gate reports ready after KPI thresholds and manual soak evidence are satisfied', (t) => {
  const tempRoot = makeTempRoot('phase873-acceptance-');
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const outputRoot = path.join(tempRoot, 'artifacts');
  const runsRoot = path.join(outputRoot, 'runs');
  const promotionsRoot = path.join(outputRoot, 'proposals', 'promotions');
  const manualReportPath = path.join(tempRoot, 'acceptance.manual.json');
  const outputPath = path.join(outputRoot, 'acceptance', 'latest.json');

  for (let index = 0; index < 10; index += 1) {
    const runId = `ldp_acceptance_${String(index).padStart(2, '0')}`;
    writeJson(path.join(runsRoot, runId, 'trace.json'), {
      run_id: runId,
      scenario_id: 'execute_smoke',
      session_id: `session_${runId}`,
      started_at: `2026-03-27T00:${String(index).padStart(2, '0')}:00.000Z`,
      finished_at: `2026-03-27T00:${String(index).padStart(2, '0')}:05.000Z`,
      target_id: 'sample-self-test',
      send_mode: 'execute_once',
      sent_text: `execute message ${index}`,
      target_validation: {
        matched: true,
        reason: 'matched',
      },
      send_result: {
        result: {
          status: 'sent',
          send_method: 'button',
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
  assert.equal(result.automatic.status, 'ready');
  assert.equal(result.manual.status, 'ready');
  assert.equal(result.automatic.metrics.offWhitelistSendIncidents, 0);
  assert.equal(result.automatic.metrics.targetMismatchFalseNegativeCount, 0);
  assert.equal(result.automatic.metrics.sendSuccessRate, 1);
  assert.equal(result.automatic.metrics.observeSuccessRate, 1);
  assert.equal(result.automatic.metrics.replyCorrelationUsableRate, 1);
  assert.equal(result.automatic.metrics.draftPrDuplicateRate, 0);
  assert.equal(written.overallStatus, 'ready');
});
