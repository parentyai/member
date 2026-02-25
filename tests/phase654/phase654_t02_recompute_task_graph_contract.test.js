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
const journeyTodoItemsRepo = require('../../src/repos/firestore/journeyTodoItemsRepo');
const taskNodesRepo = require('../../src/repos/firestore/taskNodesRepo');
const { recomputeJourneyTaskGraph } = require('../../src/usecases/journey/recomputeJourneyTaskGraph');

test('phase654: recompute task graph updates todo graph fields and task_nodes projection', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await journeyTodoItemsRepo.upsertJourneyTodoItem('U_PHASE654_GRAPH', 'visa_documents', {
      lineUserId: 'U_PHASE654_GRAPH',
      todoKey: 'visa_documents',
      title: 'ビザ書類確認',
      status: 'open',
      progressState: 'not_started',
      dueAt: '2026-03-02T00:00:00.000Z',
      priority: 5,
      riskLevel: 'high'
    });
    await journeyTodoItemsRepo.upsertJourneyTodoItem('U_PHASE654_GRAPH', 'housing_setup', {
      lineUserId: 'U_PHASE654_GRAPH',
      todoKey: 'housing_setup',
      title: '住居準備',
      status: 'open',
      progressState: 'not_started',
      dueAt: '2026-03-04T00:00:00.000Z',
      dependsOn: ['visa_documents'],
      priority: 4,
      riskLevel: 'high'
    });

    const recomputed = await recomputeJourneyTaskGraph({
      lineUserId: 'U_PHASE654_GRAPH',
      actor: 'phase654_test',
      requestId: 'req_phase654_graph_1',
      traceId: 'trace_phase654_graph_1',
      nowMs: Date.parse('2026-03-01T00:00:00.000Z')
    });

    assert.equal(recomputed.ok, true);
    assert.ok(Array.isArray(recomputed.nodes));
    assert.ok(Array.isArray(recomputed.topActionableTasks));
    assert.ok(recomputed.topActionableTasks.length <= 3);

    const lockedTodo = await journeyTodoItemsRepo.getJourneyTodoItem('U_PHASE654_GRAPH', 'housing_setup');
    assert.equal(lockedTodo.graphStatus, 'locked');
    assert.ok(Array.isArray(lockedTodo.lockReasons));
    assert.ok(lockedTodo.lockReasons.some((reason) => reason.includes('依存未完了')));

    const projectedNodes = await taskNodesRepo.listTaskNodesByLineUserId({ lineUserId: 'U_PHASE654_GRAPH', limit: 10 });
    assert.equal(projectedNodes.length, 2);
    const projectedLocked = projectedNodes.find((item) => item.todoKey === 'housing_setup');
    assert.ok(projectedLocked, 'housing_setup projection missing');
    assert.equal(projectedLocked.status, 'locked');
    assert.equal(projectedLocked.graphStatus, 'locked');

    const auditSnap = await db.collection('audit_logs').get();
    const actions = auditSnap.docs.map((doc) => doc.data().action);
    assert.ok(actions.includes('journey_task_graph.recomputed'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase654: recompute task graph rejects cycle when failOnCycle is enabled and records audit', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await journeyTodoItemsRepo.upsertJourneyTodoItem('U_PHASE654_CYCLE', 'cycle_a', {
      lineUserId: 'U_PHASE654_CYCLE',
      todoKey: 'cycle_a',
      status: 'open',
      dependsOn: ['cycle_b']
    });
    await journeyTodoItemsRepo.upsertJourneyTodoItem('U_PHASE654_CYCLE', 'cycle_b', {
      lineUserId: 'U_PHASE654_CYCLE',
      todoKey: 'cycle_b',
      status: 'open',
      dependsOn: ['cycle_a']
    });

    let caught = null;
    try {
      await recomputeJourneyTaskGraph({
        lineUserId: 'U_PHASE654_CYCLE',
        actor: 'phase654_test',
        requestId: 'req_phase654_graph_cycle',
        traceId: 'trace_phase654_graph_cycle',
        failOnCycle: true
      });
    } catch (err) {
      caught = err;
    }

    assert.ok(caught, 'cycle should raise task_graph_cycle_detected error');
    assert.equal(caught.code, 'task_graph_cycle_detected');

    const auditSnap = await db.collection('audit_logs').get();
    const actions = auditSnap.docs.map((doc) => doc.data().action);
    assert.ok(actions.includes('journey_task_graph.cycle_detected'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
