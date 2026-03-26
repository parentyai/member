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
