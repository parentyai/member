'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const { runPythonCode } = require('../phase863/_line_desktop_patrol_screenshot_test_helper');

test('phase881: synthesize_code_patch_bundle writes worktree-aware file snapshots', (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase881-code-patch-'));
  t.after(() => fs.rmSync(tempRoot, { recursive: true, force: true }));

  const queueRoot = path.join(tempRoot, 'proposals');
  const packetRoot = path.join(queueRoot, 'packets');
  const worktreeRoot = path.join(tempRoot, 'worktree');
  fs.mkdirSync(packetRoot, { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'docs'), { recursive: true });
  fs.mkdirSync(path.join(worktreeRoot, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol'), { recursive: true });
  fs.writeFileSync(path.join(worktreeRoot, '.git'), 'gitdir: mock');
  fs.writeFileSync(path.join(worktreeRoot, 'docs', 'RUNBOOK_LINE_DESKTOP_PATROL.md'), '# local preview\nline1\nline2\n');
  fs.writeFileSync(path.join(worktreeRoot, 'tools', 'line_desktop_patrol', 'src', 'member_line_patrol', 'execute_harness.py'), 'def demo():\n    return "ok"\n');
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_code_patch_demo',
    source_trace_ids: ['ldp_execute_04'],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: [
      'tools/line_desktop_patrol/src/member_line_patrol/execute_harness.py',
      'docs/RUNBOOK_LINE_DESKTOP_PATROL.md',
    ],
    expected_score_delta: 0.15,
    risk_level: 'medium',
    requires_human_review: true,
  })}\n`);
  fs.writeFileSync(path.join(packetRoot, 'proposal_code_patch_demo.codex.json'), JSON.stringify({
    proposal_id: 'proposal_code_patch_demo',
    trace_ref: { run_id: 'ldp_execute_04', trace_path: '/tmp/trace.json', scenario_id: 'member_only_execute_smoke', target_id: 'member-self-test', failure_reason: 'execute_evaluated' },
    evaluation_ref: { planning_status: 'ready', analysis_status: 'root_cause_identified', observation_status: 'reply_observed' },
    operator_summary: { headline: 'reply drift seen', status: 'needs_patch' },
    proposal: {
      title: 'Tighten execute wording',
      why_now: 'Observed in execute acceptance.',
      why_not_others: 'Keep the diff minimal.',
      root_cause_refs: ['execute:continuity_fix'],
      expected_impact: ['Improve execute harness wording'],
      rollback_plan: ['Revert the patch branch if traces regress.'],
    },
  }, null, 2));

  const code = `
import json
from member_line_patrol.synthesize_code_patch_bundle import synthesize_code_patch_bundle

def fake_runner(argv, cwd=None):
    cmd = " ".join(argv)
    if "rev-list" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "0 0", "stderr": ""})()
    if "status --porcelain" in cmd:
        return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()
    return type("Completed", (), {"returncode": 0, "stdout": "", "stderr": ""})()

result = synthesize_code_patch_bundle(
    proposal_id="proposal_code_patch_demo",
    queue_root=${JSON.stringify(queueRoot)},
    repo_root=${JSON.stringify(path.resolve(__dirname, '..', '..'))},
    worktree_path=${JSON.stringify(worktreeRoot)},
    runner=fake_runner,
)
print(json.dumps(result))
`;

  const result = JSON.parse(runPythonCode(code));
  const bundleJson = JSON.parse(fs.readFileSync(result.code_patch_bundle_path, 'utf8'));
  const bundleMd = fs.readFileSync(result.code_patch_bundle_markdown_path, 'utf8');

  assert.equal(result.status, 'ready_for_human_code_patch');
  assert.ok(fs.existsSync(result.code_patch_bundle_path));
  assert.ok(fs.existsSync(result.code_patch_bundle_markdown_path));
  assert.equal(bundleJson.proposal_id, 'proposal_code_patch_demo');
  assert.equal(bundleJson.file_snapshots.length, 2);
  assert.equal(bundleJson.file_snapshots[0].exists, true);
  assert.match(bundleJson.file_snapshots[0].preview, /def demo/);
  assert.match(bundleMd, /Code patch synthesis bundle for proposal_code_patch_demo/);
  assert.match(bundleMd, /File snapshots/);
  assert.match(bundleMd, /RUNBOOK_LINE_DESKTOP_PATROL.md/);
});
