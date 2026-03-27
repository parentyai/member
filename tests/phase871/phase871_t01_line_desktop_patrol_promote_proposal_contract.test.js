'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase871: promote_proposal prepares branch and draft body but skips draft PR when no branch diff exists', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase871-promote-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_demo',
    source_trace_ids: ['ldp_execute_01'],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: ['docs/LINE_DESKTOP_PATROL_ARCHITECTURE.md'],
    expected_score_delta: 0.1,
    risk_level: 'medium',
    requires_human_review: true
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_demo',
    trace_ref: { run_id: 'ldp_execute_01', trace_path: '/tmp/trace.json', scenario_id: 'execute_city_followup', target_id: 'sample-self-test', failure_reason: 'execute_queued' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    proposal: { title: 'Improve execute wording', why_now: 'Observed in execute harness', why_not_others: 'Smallest safe scope' }
  }, null, 2));

  const code = `
import json
from pathlib import Path
from member_line_patrol.promote_proposal import promote_proposal

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
    if "push -u" in cmd or "gh pr create" in cmd:
        return type("Completed", (), {"returncode": 1, "stdout": "", "stderr": "should_not_run"})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = promote_proposal(
    proposal_id="proposal_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(path.join(tempRoot, 'worktree'))},
    create_draft_pr=True,
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  assert.equal(result.status, 'prepared_no_branch_diff');
  assert.equal(result.queue_entry.proposal_id, 'proposal_demo');
  assert.ok(fs.existsSync(result.body_path));
  assert.ok(fs.existsSync(result.record_path));
});
