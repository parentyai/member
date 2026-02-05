'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('module');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { recordClickAndRedirect } = require('../../src/usecases/track/recordClickAndRedirect');

function withPatched(obj, key, value) {
  const prev = obj[key];
  obj[key] = value;
  return () => {
    obj[key] = prev;
  };
}

test('phase21 t06: clickCount increments for openB in day window', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  process.env.SERVICE_MODE = 'track';
  delete process.env.PHASE18_CTA_EXPERIMENT;

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const originalLoad = Module._load;
  const restore = [
    withPatched(Module, '_load', (request, parent, isMain) => {
      if (request === 'firebase-admin') {
        return {
          firestore: {
            FieldValue: {
              increment: (value) => value
            }
          }
        };
      }
      return originalLoad(request, parent, isMain);
    })
  ];

  try {
    const link = await linkRegistryRepo.createLink({
      url: 'https://example.com',
      lastHealth: { state: 'OK' }
    });

    const notificationA = await notificationsRepo.createNotification({
      title: 'phase21 t06 A',
      body: 'click: https://example.com',
      ctaText: 'openA',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo'
    });

    const notificationB = await notificationsRepo.createNotification({
      title: 'phase21 t06 B',
      body: 'click: https://example.com',
      ctaText: 'openB',
      linkRegistryId: link.id,
      scenarioKey: 'A',
      stepKey: '3mo'
    });

    assert.ok(notificationA.id);
    assert.ok(notificationB.id);

    const delivery = await deliveriesRepo.createDelivery({
      notificationId: notificationB.id,
      lineUserId: 'U1'
    });

    const result = await recordClickAndRedirect({
      deliveryId: delivery.id,
      linkRegistryId: link.id
    });

    assert.equal(result.url, 'https://example.com');

    const statsDoc = db._state.collections.phase18_cta_stats.docs[notificationB.id];
    assert.ok(statsDoc);
    assert.equal(statsDoc.data.ctaText, 'openB');
    assert.equal(statsDoc.data.clickCount, 1);
  } finally {
    restore.reverse().forEach((fn) => fn());
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
  }
});
