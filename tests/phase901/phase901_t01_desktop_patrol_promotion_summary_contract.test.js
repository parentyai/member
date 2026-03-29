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

test('phase901: desktop patrol summary exposes latest promotion kind/status/draft ref add-only', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase901-desktop-patrol-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const promotionPath = path.join(
    artifactRoot,
    'proposals',
    'promotions',
    'prop_001.code_apply_record.json'
  );

  writeJson(promotionPath, {
    proposal_id: 'prop_001',
    status: 'completed',
    draft_pr_ref: 'refs/pull/1001/head',
    updated_at: '2026-03-27T22:45:00.000Z'
  });

  const result = await queryLatestDesktopPatrolSummary({ audience: 'operator' }, { artifactRoot });

  assert.equal(result.ok, true);
  assert.equal(result.promotion.latestProposalId, 'prop_001');
  assert.equal(result.promotion.latestArtifactKind, 'code_apply_record');
  assert.equal(result.promotion.latestArtifactStatus, 'completed');
  assert.equal(result.promotion.latestDraftPrRef, 'refs/pull/1001/head');
  assert.equal(result.promotion.updatedAt, '2026-03-27T22:45:00.000Z');
  assert.ok(result.artifactRefs.some((item) => item.kind === 'promotion' && item.path === promotionPath));
});

test('phase901: desktop patrol summary exposes latest self-improvement promotion batch add-only', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase901-desktop-patrol-batch-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const summaryPath = path.join(
    artifactRoot,
    'self_improvement_runs',
    'desktop-self-improve-001',
    'summary.json'
  );

  writeJson(summaryPath, {
    ok: true,
    batchRunId: 'desktop-self-improve-001',
    nextAction: 'Review the prepared human code edit tasks before any apply_patch step.',
    roundSummary: {
      completionStatus: 'proposal_review_required',
      promotionSummary: {
        statusCounts: {
          skipped: 3,
          patch_draft_ready: 2
        },
        queuedProposalCount: 4,
        patchDraftReadyCount: 2,
        blockedCaseIds: ['parent_friendly_rephrase']
      }
    }
  });

  const result = await queryLatestDesktopPatrolSummary({ audience: 'operator' }, { artifactRoot });

  assert.equal(result.ok, true);
  assert.equal(result.promotionBatch.batchRunId, 'desktop-self-improve-001');
  assert.equal(result.promotionBatch.completionStatus, 'proposal_review_required');
  assert.equal(result.promotionBatch.queuedProposalCount, 4);
  assert.equal(result.promotionBatch.patchDraftReadyCount, 2);
  assert.deepEqual(result.promotionBatch.blockedCaseIds, ['parent_friendly_rephrase']);
  assert.deepEqual(result.promotionBatch.statusCounts, {
    skipped: 3,
    patch_draft_ready: 2
  });
  assert.equal(
    result.promotionBatch.nextAction,
    'Review the prepared human code edit tasks before any apply_patch step.'
  );
  assert.ok(result.promotionBatch.updatedAt);
  assert.ok(result.artifactRefs.some((item) => item.kind === 'promotion_batch_summary' && item.path === summaryPath));
});
