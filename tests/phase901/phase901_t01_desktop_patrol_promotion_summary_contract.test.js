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
