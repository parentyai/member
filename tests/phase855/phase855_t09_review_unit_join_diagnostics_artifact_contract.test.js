'use strict';

const fs = require('node:fs');
const test = require('node:test');
const assert = require('node:assert/strict');

const { run } = require('../../tools/run_quality_patrol');
const { tempJsonPath, cleanupPaths, buildPatrolDeps } = require('./phase855_helpers');

test('phase855: patrol job artifact preserves review-unit join diagnostics without changing top-level contract', async () => {
  const outputPath = tempJsonPath('join_diagnostics');
  const deps = buildPatrolDeps({
    buildConversationReviewUnitsFromSources: async () => ({
      ok: true,
      sourceWindow: { fromAt: '2026-03-14T00:00:00.000Z', toAt: '2026-03-14T01:00:00.000Z' },
      reviewUnits: [],
      sourceCollections: ['llm_action_logs', 'faq_answer_logs', 'trace_bundle'],
      counts: { snapshots: 0, llmActionLogs: 2, faqAnswerLogs: 3, traceBundles: 1 },
      joinDiagnostics: {
        faqOnlyRowsSkipped: 3,
        traceHydrationLimitedCount: 1,
        reviewUnitAnchorKindCounts: { action_only: 2 }
      }
    })
  });

  await run([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    outputPath
  ], deps);

  const artifact = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  assert.equal(artifact.artifactVersion, 'quality_patrol_job_v1');
  assert.ok(artifact.runtimeFetchStatus);
  assert.deepEqual(artifact.runtimeFetchStatus.reviewUnits.joinDiagnostics, {
    faqOnlyRowsSkipped: 3,
    traceHydrationLimitedCount: 1,
    reviewUnitAnchorKindCounts: { action_only: 2 }
  });
  assert.ok(Array.isArray(artifact.issues));
  assert.ok(Array.isArray(artifact.evidence));

  cleanupPaths(outputPath);
});
