'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const decisionLogsRepo = require('../../src/repos/firestore/decisionLogsRepo');
const { getNotificationReadModel } = require('../../src/usecases/admin/getNotificationReadModel');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase37: notification summary includes decision trace when linked', async () => {
  const created = await notificationsRepo.createNotification({
    title: 'T',
    scenarioKey: 'S',
    stepKey: 'step',
    ctaText: 'Go',
    linkRegistryId: 'link1',
    status: 'sent',
    createdAt: '2026-02-08T00:00:00Z'
  });

  await deliveriesRepo.createDelivery({
    notificationId: created.id,
    lineUserId: 'U1',
    sentAt: '2026-02-08T00:00:00Z',
    delivered: true
  });

  const decision = await decisionLogsRepo.appendDecision({
    subjectType: 'user',
    subjectId: 'U1',
    decision: 'OK',
    nextAction: 'NO_ACTION',
    decidedBy: 'ops',
    reason: 'ok',
    audit: { notificationId: created.id }
  });

  await decisionLogsRepo.appendDecision({
    subjectType: 'ops_execution',
    subjectId: decision.id,
    decision: 'EXECUTE',
    nextAction: 'NO_ACTION',
    decidedBy: 'system',
    reason: 'execution',
    audit: {
      execution: {
        result: 'FAIL',
        executedAt: '2026-02-08T01:00:00Z'
      }
    }
  });

  const items = await getNotificationReadModel({ limit: 10 });
  const item = items.find((entry) => entry.notificationId === created.id);

  assert.ok(item);
  assert.ok(item.decisionTrace);
  assert.strictEqual(item.decisionTrace.firstDecisionLogId, decision.id);
  assert.strictEqual(item.decisionTrace.lastDecisionLogId, decision.id);
  assert.strictEqual(item.decisionTrace.lastExecutionResult, 'FAIL');
  assert.strictEqual(item.decisionTrace.lastExecutedAt, '2026-02-08T01:00:00.000Z');
});
