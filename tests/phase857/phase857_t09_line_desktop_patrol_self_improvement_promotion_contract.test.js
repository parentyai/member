'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  runPromotionPipeline,
  summarizeRound,
} = require('../../tools/line_desktop_patrol/run_desktop_self_improvement_batch');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return filePath;
}

function buildArtifacts() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'line-self-improve-promotion-'));
  const tracePath = writeJson(path.join(tempDir, 'trace.json'), {
    run_id: 'line-patrol-test-run',
    scenario_id: 'direct_answer_school_start',
    target_id: 'sample-self-test',
  });
  const planningOutputPath = writeJson(path.join(tempDir, 'planning.json'), {
    recommendedPr: [
      {
        proposalKey: 'proposal_runtime_fix',
        proposalType: 'runtime_fix',
        title: 'Tighten direct answer reply shaping',
        objective: 'Keep the reply short and direct.',
        whyNow: 'The fixed batch found a routing gap.',
        whyNotOthers: 'This is the smallest local fix.',
        targetFiles: ['src/usecases/assistant/generatePaidDomainConciergeReply.js'],
        expectedImpact: ['raise direct-answer-first pass rate'],
        rollbackPlan: ['revert the shaping-only patch'],
        rootCauseRefs: ['root_cause:routing_gap'],
        riskLevel: 'medium',
      },
    ],
  });
  const mainOutputPath = writeJson(path.join(tempDir, 'main.json'), {
    planningStatus: 'planned',
    analysisStatus: 'pass',
    observationStatus: 'pass',
    summary: {
      headline: 'direct answer drift',
      status: 'needs_patch',
    },
    recommendedPrCount: 1,
  });
  return {
    tempDir,
    tracePath,
    planningOutputPath,
    mainOutputPath,
  };
}

function argsContain(args, token) {
  return Array.isArray(args) && args.some((item) => String(item).includes(token));
}

test('phase857: promotion pipeline skips cleanly when there are no proposals', () => {
  const result = runPromotionPipeline({
    planningProposals: [],
    policyRuntime: {
      ok: true,
      proposalMode: 'local_queue',
      autoApplyLevel: 'patch_draft',
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, 'skipped_no_proposals');
});

test('phase857: promotion pipeline queues proposals in local_queue mode without patch draft synthesis', () => {
  const artifacts = buildArtifacts();
  const calls = [];
  try {
    const result = runPromotionPipeline({
      planningProposals: [{ title: 'runtime fix' }],
      tracePath: artifacts.tracePath,
      planningOutputPath: artifacts.planningOutputPath,
      mainOutputPath: artifacts.mainOutputPath,
      queueRoot: path.join(artifacts.tempDir, 'queue-root'),
      policyRuntime: {
        ok: true,
        proposalMode: 'local_queue',
        autoApplyLevel: 'none',
      },
      runner(command, args) {
        calls.push([command, args]);
        return {
          status: 0,
          stdout: JSON.stringify({
            ok: true,
            queuedProposalIds: ['proposal_runtime_fix'],
            duplicateProposalIds: [],
            queuePath: path.join(artifacts.tempDir, 'queue-root', 'queue.jsonl'),
          }),
          stderr: '',
        };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'queued');
    assert.deepEqual(result.proposalIds, ['proposal_runtime_fix']);
    assert.equal(calls.length, 1);
    assert.equal(argsContain(calls[0][1], 'member_line_patrol.enqueue_eval_proposals'), true);
  } finally {
    fs.rmSync(artifacts.tempDir, { recursive: true, force: true });
  }
});

test('phase857: promotion pipeline prepares patch drafts when policy requests patch_draft', () => {
  const artifacts = buildArtifacts();
  const calls = [];
  try {
    const result = runPromotionPipeline({
      planningProposals: [{ title: 'runtime fix' }],
      tracePath: artifacts.tracePath,
      planningOutputPath: artifacts.planningOutputPath,
      mainOutputPath: artifacts.mainOutputPath,
      queueRoot: path.join(artifacts.tempDir, 'queue-root'),
      repoRoot: '/Volumes/Arumamihs/Member-next-llm-loop',
      baseRef: 'origin/main',
      policyRuntime: {
        ok: true,
        proposalMode: 'local_queue',
        autoApplyLevel: 'patch_draft',
      },
      runner(command, args) {
        calls.push([command, args]);
        if (argsContain(args, 'member_line_patrol.enqueue_eval_proposals')) {
          return {
            status: 0,
            stdout: JSON.stringify({
              ok: true,
              queuedProposalIds: ['proposal_runtime_fix'],
              duplicateProposalIds: [],
            }),
            stderr: '',
          };
        }
        return {
          status: 0,
          stdout: JSON.stringify({
            ok: true,
            proposal_id: 'proposal_runtime_fix',
            code_edit_task_path: path.join(artifacts.tempDir, 'queue-root', 'promotions', 'proposal_runtime_fix.code_edit_task.json'),
          }),
          stderr: '',
        };
      },
    });
    assert.equal(result.ok, true);
    assert.equal(result.status, 'queued_and_patch_draft_ready');
    assert.equal(result.patchDraftResult.generatedCount, 1);
    assert.equal(calls.length, 2);
    assert.equal(argsContain(calls[1][1], 'member_line_patrol.synthesize_code_edit_task'), true);
  } finally {
    fs.rmSync(artifacts.tempDir, { recursive: true, force: true });
  }
});

test('phase857: round summary exposes promotion blockers separately from reply failures', () => {
  const summary = summarizeRound({
    batchId: 'strategic_desktop_self_improvement_v1',
    fixedCaseCount: 1,
  }, [
    {
      caseId: 'direct_answer_school_start',
      improvementAxis: 'direct_answer_first',
      loopVerdict: 'pass',
      caseVerdict: 'pass',
      planningProposals: [{ proposalType: 'runtime_fix', title: 'example' }],
      replyContract: { verdict: true },
      promotionResult: {
        ok: false,
        status: 'queue_failed',
        proposalIds: [],
      },
    },
  ]);
  assert.equal(summary.completionStatus, 'promotion_blocked');
  assert.deepEqual(summary.promotionSummary.blockedCaseIds, ['direct_answer_school_start']);
});
