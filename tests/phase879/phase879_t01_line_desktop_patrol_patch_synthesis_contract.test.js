'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase879: synthesize_patch_task writes patch request artifacts with candidate edits and validation commands', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase879-synth-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_synth_demo',
    source_trace_ids: ['ldp_execute_03'],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: [
      'tools/line_desktop_patrol/src/member_line_patrol/execute_harness.py',
      'docs/RUNBOOK_LINE_DESKTOP_PATROL.md',
    ],
    expected_score_delta: 0.14,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_synth_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_synth_demo',
    trace_ref: { run_id: 'ldp_execute_03', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'reply drift seen', status: 'needs_patch' },
    proposal: {
      title: 'Tighten execute patch synthesis',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['execute:continuity_fix'],
      expected_impact: ['Improve execute harness wording'],
      rollback_plan: ['Revert the patch branch if traces regress.'],
    },
  }, null, 2));

  const code = `
import json
from pathlib import Path
from member_line_patrol.synthesize_patch_task import synthesize_patch_task

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "worktree add" in cmd:
        worktree_path = Path(argv[5])
        worktree_path.mkdir(parents=True, exist_ok=True)
        (worktree_path / ".git").write_text("gitdir: mock")
        return type("Completed", (), {"returncode": 0, "stdout": "worktree created", "stderr": ""})()
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_patch_task(
    proposal_id="proposal_synth_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(path.join(tempRoot, 'worktree'))},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const requestJson = JSON.parse(fs.readFileSync(result.patch_request_path, 'utf8'));
  const requestMd = fs.readFileSync(result.patch_request_markdown_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_patch');
  assert.ok(Array.isArray(result.validation_commands) && result.validation_commands.length >= 3);
  assert.ok(Array.isArray(result.candidate_edits) && result.candidate_edits.length === 2);
  assert.ok(fs.existsSync(result.patch_request_path));
  assert.ok(fs.existsSync(result.patch_request_markdown_path));
  assert.equal(requestJson.proposal_id, 'proposal_synth_demo');
  assert.match(requestMd, /Patch synthesis bundle for proposal_synth_demo/);
  assert.match(requestMd, /Validation commands/);
  assert.match(requestMd, /execute_harness.py/);
});
