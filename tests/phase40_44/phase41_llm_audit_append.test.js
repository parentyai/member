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

const decisionTimelineRepo = require('../../src/repos/firestore/decisionTimelineRepo');
const { getOpsAssistSuggestion } = require('../../src/usecases/phase40/getOpsAssistSuggestion');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-08T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase41: llm assist suggestion appends timeline entry', async () => {
  const deps = {
    getOpsAssistContext: async () => ({
      opsState: null,
      decisionTimeline: [],
      constraints: { readiness: 'NOT_READY', allowedNextActions: [] }
    }),
    decisionTimelineRepo
  };

  await getOpsAssistSuggestion({ lineUserId: 'U1' }, deps);

  const entries = await decisionTimelineRepo.listTimelineEntries('U1', 5);
  const entry = entries.find((item) => item.source === 'llm_assist' && item.action === 'SUGGEST');
  assert.ok(entry);
  assert.strictEqual(entry.snapshot.disclaimer, 'This is advisory only');
});
