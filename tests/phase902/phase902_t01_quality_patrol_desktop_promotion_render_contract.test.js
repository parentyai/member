'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');

test('phase902: desktop patrol admin render and docs surface latest promotion add-only', () => {
  const js = fs.readFileSync('apps/admin/assets/admin_app.js', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');
  const lineRunbook = fs.readFileSync('docs/RUNBOOK_LINE_DESKTOP_PATROL.md', 'utf8');
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const architecture = fs.readFileSync('docs/LINE_DESKTOP_PATROL_ARCHITECTURE.md', 'utf8');
  const dataMap = fs.readFileSync('docs/DATA_MAP.md', 'utf8');

  assert.ok(js.includes("title: 'Latest promotion'"));
  assert.ok(js.includes("title: 'Latest promotion batch'"));
  assert.ok(js.includes('promotion.latestArtifactKind'));
  assert.ok(js.includes('promotion.latestArtifactStatus'));
  assert.ok(js.includes('promotion.latestDraftPrRef'));
  assert.ok(js.includes('promotionBatch.patchDraftReadyCount'));
  assert.ok(js.includes('promotionBatch.nextAction'));

  assert.ok(runbook.includes('latest promotion kind / status / draft PR ref / updatedAt'));
  assert.ok(runbook.includes('desktopPatrolSummary.promotionBatch'));
  assert.ok(lineRunbook.includes('desktopPatrolSummary.promotion'));
  assert.ok(lineRunbook.includes('desktopPatrolSummary.promotionBatch'));
  assert.ok(ssot.includes('Latest promotion'));
  assert.ok(ssot.includes('Latest promotion batch'));
  assert.ok(architecture.includes('promotion.latestArtifactKind'));
  assert.ok(architecture.includes('promotionBatch.batchRunId'));
  assert.ok(dataMap.includes('desktopPatrolSummary.promotion.latestArtifactKind'));
  assert.ok(dataMap.includes('desktopPatrolSummary.promotionBatch.batchRunId'));
});
