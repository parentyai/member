'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase899: synthesize_code_apply_record writes final post-apply record bundle', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase899-code-apply-record-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  const worktreeRoot = path.join(tempRoot, 'worktree');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), 'gitdir: mock');
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md'), '# apply preview\ncurrent text\n');
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_code_apply_record_demo',
    source_trace_ids: ['ldp_execute_15'],
    root_cause_category: 'docs_gap',
    proposed_change_scope: 'runbook',
    affected_files: ['docs/RUNBOOK_LINE_DESKTOP_PATROL.md'],
    expected_score_delta: 0.1,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_code_apply_record_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_code_apply_record_demo',
    trace_ref: { run_id: 'ldp_execute_15', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'needs final apply record', status: 'needs_patch' },
    proposal: {
      title: 'Apply record bundle',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['docs:clarify_apply_record'],
      expected_impact: ['Clarify final post-apply closure'],
      rollback_plan: ['Revert the branch if final record is invalid.'],
    },
  }, null, 2));

  const code = `
import json
from member_line_patrol.synthesize_code_apply_record import synthesize_code_apply_record

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_code_apply_record(
    proposal_id="proposal_code_apply_record_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(worktreeRoot)},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const recordJson = JSON.parse(fs.readFileSync(result.code_apply_record_path, 'utf8'));
  const recordMd = fs.readFileSync(result.code_apply_record_markdown_path, 'utf8');
  const promptMd = fs.readFileSync(result.record_prompt_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_apply_record');
  assert.ok(fs.existsSync(result.code_apply_record_path));
  assert.ok(fs.existsSync(result.code_apply_record_markdown_path));
  assert.ok(fs.existsSync(result.record_prompt_path));
  assert.equal(recordJson.record_requirements.length, 4);
  assert.match(recordMd, /Code apply record for proposal_code_apply_record_demo/);
  assert.match(recordMd, /Record requirements/);
  assert.match(promptMd, /post-apply and post-merge record/);
});
