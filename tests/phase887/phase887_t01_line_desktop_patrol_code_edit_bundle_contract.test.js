'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase887: synthesize_code_edit_bundle writes worker prompt and expected outputs', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase887-code-edit-bundle-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  const worktreeRoot = path.join(tempRoot, 'worktree');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), 'gitdir: mock');
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md'), '# worker prompt anchor\ncurrent text\n');
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_code_edit_bundle_demo',
    source_trace_ids: ['ldp_execute_07'],
    root_cause_category: 'docs_gap',
    proposed_change_scope: 'runbook',
    affected_files: ['docs/RUNBOOK_LINE_DESKTOP_PATROL.md'],
    expected_score_delta: 0.09,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_code_edit_bundle_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_code_edit_bundle_demo',
    trace_ref: { run_id: 'ldp_execute_07', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'needs bundle', status: 'needs_patch' },
    proposal: {
      title: 'Bundle worker prompt',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['docs:clarify_worker_handoff'],
      expected_impact: ['Clarify the code-edit handoff'],
      rollback_plan: ['Revert the branch if the handoff is wrong.'],
    },
  }, null, 2));

  const code = `
import json
from member_line_patrol.synthesize_code_edit_bundle import synthesize_code_edit_bundle

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_code_edit_bundle(
    proposal_id="proposal_code_edit_bundle_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(worktreeRoot)},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const bundleJson = JSON.parse(fs.readFileSync(result.code_edit_bundle_path, 'utf8'));
  const bundleMd = fs.readFileSync(result.code_edit_bundle_markdown_path, 'utf8');
  const promptMd = fs.readFileSync(result.worker_prompt_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_code_edit_bundle');
  assert.ok(fs.existsSync(result.code_edit_bundle_path));
  assert.ok(fs.existsSync(result.code_edit_bundle_markdown_path));
  assert.ok(fs.existsSync(result.worker_prompt_path));
  assert.equal(bundleJson.task_packets.length, 1);
  assert.match(bundleMd, /Code edit bundle for proposal_code_edit_bundle_demo/);
  assert.match(promptMd, /Expected outputs:/);
  assert.match(promptMd, /Validation commands:/);
});
