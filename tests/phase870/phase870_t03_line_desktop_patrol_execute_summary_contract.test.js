'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  queryLatestDesktopPatrolSummary
} = require('../../src/usecases/qualityPatrol/queryLatestDesktopPatrolSummary');

test('phase870: desktop summary surfaces execute-specific latest run fields', async (t) => {
  const artifactRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'phase870-desktop-summary-'));
  t.after(() => fs.rmSync(artifactRoot, { recursive: true, force: true }));

  const runId = 'ldp_execute_summary_01';
  const runRoot = path.join(artifactRoot, 'runs', runId);
  const queueRoot = path.join(artifactRoot, 'proposals');
  fs.mkdirSync(runRoot, { recursive: true });
  fs.mkdirSync(queueRoot, { recursive: true });
  fs.writeFileSync(path.join(runRoot, 'trace.json'), JSON.stringify({
    run_id: runId,
    scenario_id: 'execute_summary',
    session_id: 'session_execute_summary',
    started_at: '2026-03-26T06:00:00.000Z',
    finished_at: '2026-03-26T06:00:05.000Z',
    git_sha: 'abc1234',
    app_version: 'member',
    target_id: 'sample-self-test',
    sent_text: '実行確認です。',
    visible_before: [],
    visible_after: [{ role: 'unknown', text: '了解しました。' }],
    screenshot_before: null,
    screenshot_after: null,
    ax_tree_before: null,
    ax_tree_after: null,
    model_config: {},
    retrieval_refs: [],
    evaluator_scores: { status: 'completed' },
    failure_reason: 'execute_queued',
    proposal_id: 'proposal_demo',
    send_mode: 'execute_once',
    send_result: { result: { status: 'sent' } },
    target_validation: { matched: true, reason: 'matched' },
    correlation_status: 'reply_observed'
  }, null, 2));
  fs.writeFileSync(path.join(queueRoot, 'queue.jsonl'), `${JSON.stringify({
    proposal_id: 'proposal_demo',
    source_trace_ids: [runId],
    root_cause_category: 'routing_gap',
    proposed_change_scope: 'routing',
    affected_files: ['src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace.js'],
    expected_score_delta: 0.1,
    risk_level: 'medium',
    requires_human_review: true,
    draft_pr_ref: 'refs/pull/999/head'
  })}\n`);

  const result = await queryLatestDesktopPatrolSummary({ audience: 'operator' }, { artifactRoot });
  assert.equal(result.ok, true);
  assert.equal(result.latestRun.executionMode, 'execute_once');
  assert.equal(result.latestRun.sendStatus, 'sent');
  assert.equal(result.latestRun.targetValidationStatus, 'matched');
  assert.equal(result.latestRun.replyObservationStatus, 'reply_observed');
  assert.equal(result.latestRun.lastRunKind, 'execute');
  assert.equal(result.queue.latestDraftPrRef, 'refs/pull/999/head');
});
