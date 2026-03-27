'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase883: synthesize_code_edit_task writes per-file edit tasks and patch hints', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase883-code-edit-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  const worktreeRoot = path.join(tempRoot, 'worktree');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), 'gitdir: mock');
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md'), '# anchor line\ncurrent text\n');
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_code_edit_demo',
    source_trace_ids: ['ldp_execute_05'],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: ['docs/RUNBOOK_LINE_DESKTOP_PATROL.md'],
    expected_score_delta: 0.11,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_code_edit_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_code_edit_demo',
    trace_ref: { run_id: 'ldp_execute_05', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'needs patch', status: 'needs_patch' },
    proposal: {
      title: 'Edit smoke task',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['execute:continuity_fix'],
      expected_impact: ['Improve runbook wording'],
      rollback_plan: ['Revert the patch branch if traces regress.'],
    },
  }, null, 2));

  const code = `
import json
from member_line_patrol.synthesize_code_edit_task import synthesize_code_edit_task

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_code_edit_task(
    proposal_id="proposal_code_edit_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(worktreeRoot)},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const taskJson = JSON.parse(fs.readFileSync(result.code_edit_task_path, 'utf8'));
  const taskMd = fs.readFileSync(result.code_edit_task_markdown_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_code_edit');
  assert.ok(fs.existsSync(result.code_edit_task_path));
  assert.ok(fs.existsSync(result.code_edit_task_markdown_path));
  assert.equal(taskJson.edit_tasks.length, 1);
  assert.equal(taskJson.edit_tasks[0].file_path, 'docs/RUNBOOK_LINE_DESKTOP_PATROL.md');
  assert.equal(taskJson.edit_tasks[0].anchor_preview, '# anchor line');
  assert.match(taskMd, /Code edit task for proposal_code_edit_demo/);
  assert.match(taskMd, /apply_patch_hint/);
  assert.match(taskMd, /RUNBOOK_LINE_DESKTOP_PATROL.md/);
});
