'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase878: promote_proposal writes a patch draft artifact alongside the draft PR body', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase878-promote-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_patch_demo',
    source_trace_ids: ['ldp_execute_02'],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: ['src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace.js'],
    expected_score_delta: 0.12,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_patch_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_patch_demo',
    trace_ref: { run_id: 'ldp_execute_02', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    proposal: {
      title: 'Improve member-only execute wording',
      why_now: 'Observed during member-only execute acceptance.',
      why_not_others: 'Smallest safe scope.',
      root_cause_refs: ['execute:continuity_fix'],
      expected_impact: ['Increase execute trace clarity'],
      rollback_plan: ['Revert the patch draft if acceptance evidence changes.'],
    },
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
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = promote_proposal(
    proposal_id="proposal_patch_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(path.join(tempRoot, 'worktree'))},
    create_draft_pr=False,
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const patchDraft = fs.readFileSync(result.patch_draft_path, 'utf8');
  const record = JSON.parse(fs.readFileSync(result.record_path, 'utf8'));

  assert.equal(result.status, 'prepared');
  assert.ok(fs.existsSync(result.patch_draft_path));
  assert.match(patchDraft, /proposal_patch_demo/);
  assert.match(patchDraft, /expected_score_delta: 0.12/);
  assert.match(patchDraft, /buildConversationReviewUnitsFromDesktopTrace.js/);
  assert.match(patchDraft, /Do not auto-apply runtime or routing changes without human review/);
  assert.equal(record.patch_draft_path, result.patch_draft_path);
});
