'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const cityPackFeedbackRepo = require('../../src/repos/firestore/cityPackFeedbackRepo');
const eventsRepo = require('../../src/repos/firestore/eventsRepo');
const { declareCityPackFeedbackFromLine } = require('../../src/usecases/cityPack/declareCityPackFeedbackFromLine');

test('phase270: City Pack Feedback command stores feedback and event', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await usersRepo.updateUser('line_u_270', {
      regionCity: 'Austin',
      regionState: 'TX',
      regionKey: 'TX::austin'
    });

    const result = await declareCityPackFeedbackFromLine({
      lineUserId: 'line_u_270',
      text: 'City Pack Feedback: map is outdated',
      requestId: 'req_270'
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.status, 'received');

    const items = await cityPackFeedbackRepo.listFeedback({ limit: 5 });
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].status, 'queued');
    assert.strictEqual(items[0].regionKey, 'TX::austin');

    const events = await eventsRepo.listEventsByUser('line_u_270', 5);
    assert.ok(events.some((event) => event.type === 'CITY_PACK_FEEDBACK_RECEIVED'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
