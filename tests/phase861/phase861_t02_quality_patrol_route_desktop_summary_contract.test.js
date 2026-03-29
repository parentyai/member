'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const { handleQualityPatrolQuery } = require('../../src/routes/admin/qualityPatrol');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
    },
    end(chunk) {
      this.body = chunk || '';
    }
  };
}

test('phase861: quality patrol route returns nested desktop patrol summary and audit fields add-only', async () => {
  const auditCalls = [];
  const req = {
    method: 'GET',
    url: '/api/admin/quality-patrol?mode=latest&audience=operator',
    headers: {
      'x-actor': 'phase861_tester',
      'x-trace-id': 'trace_phase861_route'
    }
  };
  const res = createResponseRecorder();

  await handleQualityPatrolQuery(req, res, {
    queryLatestPatrolInsights: async () => ({
      ok: true,
      mode: 'latest',
      audience: 'operator',
      summary: {
        overallStatus: 'ready',
        topPriorityCount: 1,
        observationBlockerCount: 0
      },
      observationStatus: 'ready'
    }),
    queryLatestDesktopPatrolSummary: async () => ({
      ok: true,
      status: 'ready',
      stage: 'queued',
      latestRun: {
        runId: 'ldp_run_002',
        lastRunKind: 'execute',
        sendStatus: 'sent'
      },
      queue: { totalCount: 2, latestProposalId: 'prop_002', packetCount: 2 },
      promotion: {
        latestProposalId: 'prop_002',
        latestArtifactKind: 'code_apply_record',
        latestArtifactStatus: 'completed',
        latestDraftPrRef: 'refs/pull/2002/head',
        updatedAt: '2026-03-27T22:58:00.000Z'
      },
      promotionReview: {
        latestProposalId: 'prop_002',
        reviewStatus: 'ready_for_human_code_edit',
        latestReviewArtifactKind: 'code_edit_task',
        branchName: 'codex/line-desktop-patrol-prop-002',
        updatedAt: '2026-03-27T22:59:00.000Z'
      },
      promotionApproval: {
        latestProposalId: 'prop_002',
        approvalStage: 'code_apply_signoff',
        approvalStatus: 'ready_for_human_apply_signoff',
        validationCommandCount: 4,
        updatedAt: '2026-03-27T23:01:00.000Z'
      },
      promotionBatch: {
        batchRunId: 'desktop-self-improve-002',
        completionStatus: 'proposal_review_required',
        queuedProposalCount: 3,
        patchDraftReadyCount: 1
      }
    }),
    appendAuditLog: async (payload) => {
      auditCalls.push(payload);
    }
  });

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.desktopPatrolSummary.status, 'ready');
  assert.equal(payload.desktopPatrolSummary.stage, 'queued');
  assert.equal(payload.desktopPatrolSummary.queue.totalCount, 2);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolStatus, 'ready');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolStage, 'queued');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolQueueCount, 2);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolLatestRunId, 'ldp_run_002');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolLastRunKind, 'execute');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolSendStatus, 'sent');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionProposalId, 'prop_002');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionKind, 'code_apply_record');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionStatus, 'completed');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionDraftPrRef, 'refs/pull/2002/head');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionUpdatedAt, '2026-03-27T22:58:00.000Z');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionBatchRunId, 'desktop-self-improve-002');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionBatchCompletionStatus, 'proposal_review_required');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionBatchQueuedProposalCount, 3);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionBatchPatchDraftReadyCount, 1);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionReviewKind, 'code_edit_task');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionReviewBranch, 'codex/line-desktop-patrol-prop-002');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionReviewUpdatedAt, '2026-03-27T22:59:00.000Z');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionApprovalStage, 'code_apply_signoff');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionApprovalStatus, 'ready_for_human_apply_signoff');
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionApprovalCommandCount, 4);
  assert.equal(auditCalls[0].payloadSummary.desktopPatrolPromotionApprovalUpdatedAt, '2026-03-27T23:01:00.000Z');
});
