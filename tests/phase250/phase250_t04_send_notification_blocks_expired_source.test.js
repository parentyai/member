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
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');
const { sendNotification } = require('../../src/usecases/notifications/sendNotification');

test('phase250: sendNotification blocks when referenced source is expired', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await usersRepo.createUser('U_CP_1', {
    scenarioKey: 'A',
    stepKey: '3mo'
  });
  const link = await linkRegistryRepo.createLink({
    title: 'City Pack Link',
    url: 'https://example.com/city-pack'
  });
  const sourceRef = await sourceRefsRepo.createSourceRef({
    id: 'sr_expired',
    url: 'https://example.com/source-expired',
    status: 'active',
    validFrom: '2025-01-01T00:00:00.000Z',
    validUntil: '2025-02-01T00:00:00.000Z',
    riskLevel: 'medium'
  });
  const notification = await notificationsRepo.createNotification({
    title: 'City Pack Notice',
    body: 'Body',
    ctaText: '確認する',
    linkRegistryId: link.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    target: { all: true },
    status: 'active',
    sourceRefs: [sourceRef.id]
  });

  let pushCalled = false;
  await assert.rejects(
    sendNotification({
      notificationId: notification.id,
      killSwitch: false,
      pushFn: async () => {
        pushCalled = true;
      }
    }),
    (err) => {
      assert.strictEqual(err.blockedReasonCategory, 'SOURCE_EXPIRED');
      return true;
    }
  );
  assert.strictEqual(pushCalled, false);
});
