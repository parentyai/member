'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  queryLatestDesktopPatrolSummary
} = require('../../src/usecases/qualityPatrol/queryLatestDesktopPatrolSummary');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}

test('phase861: desktop patrol summary usecase aggregates latest local artifacts for operator audience', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase861-desktop-patrol-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const runId = 'run_001';
  const tracePath = path.join(artifactRoot, 'runs', runId, 'trace.json');
  const linkagePath = path.join(artifactRoot, 'runs', runId, 'proposal_linkage.json');
  const evalPath = path.join(artifactRoot, 'evals', runId, 'desktop_patrol_eval.json');
  const queuePath = path.join(artifactRoot, 'proposals', 'queue.jsonl');
  const packetPath = path.join(artifactRoot, 'proposals', 'packets', 'prop_001.codex.json');

  writeJson(tracePath, {
    run_id: runId,
    scenario_id: 'smoke_dry_run',
    target_id: 'line_test_target',
    finished_at: '2026-03-25T12:00:00.000Z',
    failure_reason: null
  });
  writeJson(linkagePath, {
    queued_proposal_ids: ['prop_001'],
    duplicate_proposal_ids: [],
    packet_paths: [packetPath]
  });
  writeJson(evalPath, {
    planningStatus: 'ready',
    analysisStatus: 'ready',
    observationStatus: 'ready'
  });
  fs.mkdirSync(path.dirname(queuePath), { recursive: true });
  fs.writeFileSync(queuePath, `${JSON.stringify({
    proposal_id: 'prop_001',
    source_trace_ids: [runId],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: ['src/routes/webhookLine.js'],
    expected_score_delta: 0.1,
    risk_level: 'medium',
    requires_human_review: true
  })}\n`);
  writeJson(packetPath, {
    contract_version: 'line_desktop_patrol_codex_packet_v1',
    proposal_id: 'prop_001'
  });

  const result = await queryLatestDesktopPatrolSummary({ audience: 'operator' }, { artifactRoot });

  assert.equal(result.ok, true);
  assert.equal(result.queryVersion, 'line_desktop_patrol_summary_v1');
  assert.equal(result.status, 'ready');
  assert.equal(result.stage, 'queued');
  assert.equal(result.latestRun.runId, runId);
  assert.equal(result.latestRun.scenarioId, 'smoke_dry_run');
  assert.equal(result.queue.totalCount, 1);
  assert.equal(result.queue.latestProposalId, 'prop_001');
  assert.equal(result.queue.packetCount, 1);
  assert.deepEqual(result.latestProposalIds, ['prop_001']);
  assert.equal(result.evaluation.planningStatus, 'ready');
  assert.ok(result.summary.includes(runId));
  assert.ok(result.artifactRefs.some((item) => item.kind === 'trace' && item.path === tracePath));
  assert.ok(result.artifactRefs.some((item) => item.kind === 'proposal_queue' && item.path === queuePath));
});

test('phase861: desktop patrol summary redacts artifact paths for human audience', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase861-desktop-patrol-human-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  writeJson(path.join(artifactRoot, 'runs', 'run_002', 'trace.json'), {
    run_id: 'run_002',
    scenario_id: 'smoke_dry_run',
    target_id: 'line_test_target',
    finished_at: '2026-03-25T13:00:00.000Z'
  });

  const result = await queryLatestDesktopPatrolSummary({ audience: 'human' }, { artifactRoot });

  assert.equal(result.audience, 'human');
  assert.equal(result.artifactRoot, null);
  assert.equal(result.status, 'insufficient_evidence');
  assert.equal(result.stage, 'trace_only');
  assert.ok(Array.isArray(result.artifactRefs));
  assert.ok(result.artifactRefs.length > 0);
  assert.ok(result.artifactRefs.every((item) => item.path === null));
  assert.ok(result.artifactRefs.every((item) => !String(item.displayPath || '').includes(artifactRoot)));
});

test('phase861: desktop patrol summary exposes latest promotion review pointers add-only', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase861-desktop-patrol-review-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const promotionsRoot = path.join(artifactRoot, 'proposals', 'promotions');
  const recordPath = path.join(promotionsRoot, 'prop_010.json');
  const patchRequestPath = path.join(promotionsRoot, 'prop_010.patch_request.json');
  const patchDraftPath = path.join(promotionsRoot, 'prop_010.patch_draft.md');
  const codeEditTaskPath = path.join(promotionsRoot, 'prop_010.code_edit_task.md');
  const codeApplyDraftPath = path.join(promotionsRoot, 'prop_010.code_apply_draft.md');
  const codeReviewPacketPath = path.join(promotionsRoot, 'prop_010.code_review_packet.md');
  const codeApplyTaskPath = path.join(promotionsRoot, 'prop_010.code_apply_task.json');
  const codeApplySignoffPath = path.join(promotionsRoot, 'prop_010.code_apply_signoff.json');
  const codeApplyRecordPath = path.join(promotionsRoot, 'prop_010.code_apply_record.json');

  writeJson(recordPath, {
    proposal_id: 'prop_010',
    status: 'ready_for_human_apply_record',
    branch_name: 'codex/line-desktop-patrol-prop-010',
    worktree_path: '/tmp/member-line-desktop-prop-010',
    draft_pr_ref: 'refs/pull/1010/head',
    updated_at: '2026-03-28T14:15:00.000Z'
  });
  writeJson(patchRequestPath, {
    proposal_id: 'prop_010',
    status: 'ready_for_human_patch',
    validation_commands: ['npm test', 'npm run test:docs'],
    candidate_edits: [
      { file_path: 'src/routes/webhookLine.js', action: 'inspect_then_patch', rationale: 'routing_gap' },
      { file_path: 'docs/RUNBOOK_LINE_DESKTOP_PATROL.md', action: 'inspect_then_patch', rationale: 'docs_sync' }
    ],
    operator_instructions: ['Review the patch request.', 'Run the suggested validation commands.']
  });
  writeJson(codeApplyTaskPath, {
    proposal_id: 'prop_010',
    status: 'ready_for_human_code_apply_task',
    validation_commands: ['npm test', 'npm run test:docs']
  });
  writeJson(codeApplySignoffPath, {
    proposal_id: 'prop_010',
    status: 'ready_for_human_apply_signoff',
    validation_commands: ['npm test', 'npm run test:docs']
  });
  writeJson(codeApplyRecordPath, {
    proposal_id: 'prop_010',
    status: 'ready_for_human_apply_record',
    validation_commands: ['npm test', 'npm run test:docs']
  });
  fs.mkdirSync(promotionsRoot, { recursive: true });
  fs.writeFileSync(patchDraftPath, '# patch draft\n');
  fs.writeFileSync(codeEditTaskPath, '# code edit task\n');
  fs.writeFileSync(codeApplyDraftPath, '# code apply draft\n');
  fs.writeFileSync(codeReviewPacketPath, '# code review packet\n');

  const result = await queryLatestDesktopPatrolSummary({ audience: 'operator' }, { artifactRoot });

  assert.equal(result.ok, true);
  assert.equal(result.promotionReview.latestProposalId, 'prop_010');
  assert.equal(result.promotionReview.reviewStatus, 'ready_for_human_apply_record');
  assert.equal(result.promotionReview.latestReviewArtifactKind, 'code_review_packet');
  assert.equal(result.promotionReview.latestReviewArtifactRef.path, codeReviewPacketPath);
  assert.equal(result.promotionReview.branchName, 'codex/line-desktop-patrol-prop-010');
  assert.equal(result.promotionReview.worktreeRef.path, '/tmp/member-line-desktop-prop-010');
  assert.equal(result.promotionReview.latestDraftPrRef, 'refs/pull/1010/head');
  assert.equal(result.promotionReview.patchDraftRef.path, patchDraftPath);
  assert.equal(result.promotionReview.codeEditTaskRef.path, codeEditTaskPath);
  assert.equal(result.promotionReview.codeApplyDraftRef.path, codeApplyDraftPath);
  assert.equal(result.promotionReview.codeReviewPacketRef.path, codeReviewPacketPath);
  assert.equal(result.promotionReview.updatedAt, '2026-03-28T14:15:00.000Z');
  assert.equal(result.promotionApproval.latestProposalId, 'prop_010');
  assert.equal(result.promotionApproval.approvalStage, 'code_apply_record');
  assert.equal(result.promotionApproval.approvalStatus, 'ready_for_human_apply_record');
  assert.equal(result.promotionApproval.latestDraftPrRef, 'refs/pull/1010/head');
  assert.equal(result.promotionApproval.branchName, 'codex/line-desktop-patrol-prop-010');
  assert.equal(result.promotionApproval.worktreeRef.path, '/tmp/member-line-desktop-prop-010');
  assert.equal(result.promotionApproval.patchRequestRef.path, patchRequestPath);
  assert.equal(result.promotionApproval.codeApplyTaskRef.path, codeApplyTaskPath);
  assert.equal(result.promotionApproval.codeApplySignoffRef.path, codeApplySignoffPath);
  assert.equal(result.promotionApproval.codeApplyRecordRef.path, codeApplyRecordPath);
  assert.deepEqual(result.promotionApproval.validationCommands, ['npm test', 'npm run test:docs']);
  assert.equal(result.promotionApproval.validationCommandCount, 2);
  assert.equal(result.promotionApproval.candidateEditCount, 2);
  assert.equal(result.promotionApproval.operatorInstructionCount, 2);
  assert.equal(result.promotionApproval.candidateEdits[0].filePath, 'src/routes/webhookLine.js');
  assert.equal(result.promotionApproval.updatedAt, '2026-03-28T14:15:00.000Z');
});

test('phase861: desktop patrol approval lane redacts file paths and commands for human audience', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase861-desktop-patrol-approval-human-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const promotionsRoot = path.join(artifactRoot, 'proposals', 'promotions');
  writeJson(path.join(promotionsRoot, 'prop_011.json'), {
    proposal_id: 'prop_011',
    status: 'ready_for_human_apply_signoff',
    branch_name: 'codex/line-desktop-patrol-prop-011',
    worktree_path: '/tmp/member-line-desktop-prop-011',
    draft_pr_ref: 'refs/pull/1011/head',
    updated_at: '2026-03-28T14:20:00.000Z'
  });
  writeJson(path.join(promotionsRoot, 'prop_011.patch_request.json'), {
    proposal_id: 'prop_011',
    status: 'ready_for_human_patch',
    validation_commands: ['npm test'],
    candidate_edits: [
      { file_path: 'src/routes/webhookLine.js', action: 'inspect_then_patch', rationale: 'routing_gap' }
    ],
    operator_instructions: ['Review the patch request.']
  });
  writeJson(path.join(promotionsRoot, 'prop_011.code_apply_task.json'), {
    proposal_id: 'prop_011',
    status: 'ready_for_human_code_apply_task',
    validation_commands: ['npm test']
  });

  const result = await queryLatestDesktopPatrolSummary({ audience: 'human' }, { artifactRoot });

  assert.equal(result.promotionApproval.latestProposalId, 'prop_011');
  assert.equal(result.promotionApproval.approvalStage, 'code_apply_task');
  assert.equal(result.promotionApproval.validationCommandCount, 1);
  assert.deepEqual(result.promotionApproval.validationCommands, []);
  assert.deepEqual(result.promotionApproval.operatorInstructions, []);
  assert.equal(result.promotionApproval.candidateEditCount, 1);
  assert.equal(result.promotionApproval.candidateEdits[0].filePath, null);
  assert.equal(result.promotionApproval.candidateEdits[0].hiddenForAudience, true);
});
