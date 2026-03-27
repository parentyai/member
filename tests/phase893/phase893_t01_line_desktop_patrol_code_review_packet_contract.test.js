'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase893: synthesize_code_review_packet writes prompt and approval checklist', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase893-code-review-packet-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  const worktreeRoot = path.join(tempRoot, 'worktree');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), 'gitdir: mock');
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md'), '# apply preview\ncurrent text\n');
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_code_review_demo',
    source_trace_ids: ['ldp_execute_11'],
    root_cause_category: 'docs_gap',
    proposed_change_scope: 'runbook',
    affected_files: ['docs/RUNBOOK_LINE_DESKTOP_PATROL.md'],
    expected_score_delta: 0.1,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_code_review_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_code_review_demo',
    trace_ref: { run_id: 'ldp_execute_11', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'needs review packet', status: 'needs_patch' },
    proposal: {
      title: 'Review packet bundle',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['docs:clarify_apply_review'],
      expected_impact: ['Clarify final apply review'],
      rollback_plan: ['Revert the branch if apply review fails.'],
    },
  }, null, 2));

  const code = `
import json
from member_line_patrol.synthesize_code_review_packet import synthesize_code_review_packet

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_code_review_packet(
    proposal_id="proposal_code_review_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(worktreeRoot)},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const packetJson = JSON.parse(fs.readFileSync(result.code_review_packet_path, 'utf8'));
  const packetMd = fs.readFileSync(result.code_review_packet_markdown_path, 'utf8');
  const promptMd = fs.readFileSync(result.review_prompt_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_code_review_packet');
  assert.ok(fs.existsSync(result.code_review_packet_path));
  assert.ok(fs.existsSync(result.code_review_packet_markdown_path));
  assert.ok(fs.existsSync(result.review_prompt_path));
  assert.equal(packetJson.approval_checklist.length, 4);
  assert.match(packetMd, /Code review packet for proposal_code_review_demo/);
  assert.match(packetMd, /Approval checklist/);
  assert.match(promptMd, /final human-operated apply_patch task/);
});
