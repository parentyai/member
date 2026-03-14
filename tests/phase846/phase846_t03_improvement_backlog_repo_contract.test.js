'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { buildBacklogRecord, normalizePriority } = require('../../src/domain/qualityPatrol/buildBacklogRecord');
const improvementBacklogRepo = require('../../src/repos/firestore/improvementBacklogRepo');
const { upsertImprovementBacklog } = require('../../src/usecases/qualityPatrol/upsertImprovementBacklog');
const { listTopPriorityBacklog } = require('../../src/usecases/qualityPatrol/listTopPriorityBacklog');

test('phase846: backlog record shape normalizes priority and issue linkage', () => {
  const record = buildBacklogRecord({
    issueIds: ['qi_1', 'qi_2', 'qi_1'],
    proposedPrName: 'PR-Followup-Continuity-Repair',
    objective: 'repair continuity handling',
    issueSeverities: ['high'],
    priority: 'INVALID'
  });

  assert.ok(record.backlogId.startsWith('qib_'));
  assert.deepEqual(record.issueIds, ['qi_1', 'qi_2']);
  assert.equal(record.priority, 'p1');
  assert.equal(normalizePriority({ observationBlocker: true }), 'p1');
});

test('phase846: improvement backlog upsert merges linkage and preserves highest priority', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TS');

  try {
    const first = await upsertImprovementBacklog({
      issueIds: ['qi_followup'],
      issueSeverities: ['high'],
      proposedPrName: 'PR-Followup-Continuity-Repair',
      objective: 'repair continuity handling',
      whyNow: 'follow-up regression is visible to operators',
      targetFiles: ['src/domain/qualityPatrol/evaluateConversationQuality.js'],
      expectedKpiMovement: ['continuityScoreAvg up'],
      rollbackPlan: 'revert PR-1 backlog caller',
      dependency: ['PR-3']
    });
    const second = await upsertImprovementBacklog({
      issueIds: ['qi_followup', 'qi_trace'],
      priority: 'p3',
      proposedPrName: 'PR-Followup-Continuity-Repair',
      objective: 'repair continuity handling',
      targetFiles: ['src/domain/qualityPatrol/detectIssues.js'],
      expectedKpiMovement: ['followupResolvedFromHistoryRate up'],
      dependency: ['PR-5']
    });

    assert.equal(first.id, second.id);
    const row = await improvementBacklogRepo.getImprovementBacklog(first.id);
    assert.equal(row.priority, 'p1');
    assert.deepEqual(row.issueIds, ['qi_followup', 'qi_trace']);
    assert.deepEqual(
      row.targetFiles,
      [
        'src/domain/qualityPatrol/evaluateConversationQuality.js',
        'src/domain/qualityPatrol/detectIssues.js'
      ]
    );
    assert.deepEqual(row.dependency, ['PR-3', 'PR-5']);

    const listed = await listTopPriorityBacklog({ limit: 5 });
    assert.equal(listed.length, 1);
    assert.equal(listed[0].backlogId, first.id);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
