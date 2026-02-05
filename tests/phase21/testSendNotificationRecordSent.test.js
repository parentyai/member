'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const phase18StatsRepo = require('../../src/repos/firestore/phase18StatsRepo');
const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');
const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const Module = require('module');

function withPatched(obj, key, value) {
  const prev = obj[key];
  obj[key] = value;
  return () => {
    obj[key] = prev;
  };
}

test('testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  process.env.SERVICE_MODE = 'member';
  process.env.PHASE18_CTA_EXPERIMENT = '1';

  let incrementSentArgs = null;
  let incrementSentCalls = 0;

  const restore = [
    withPatched(deliveriesRepo, 'createDelivery', async () => ({ id: 'd1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({
      id: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    })),
    withPatched(phase18StatsRepo, 'incrementSent', async (args) => {
      incrementSentCalls += 1;
      incrementSentArgs = args;
      return { id: 'n1' };
    })
  ];

  try {
    const result = await testSendNotification({
      lineUserId: 'U1',
      text: 'hello',
      notificationId: 'n1',
      pushFn: async () => {}
    });
    assert.equal(result.id, 'd1');
    assert.equal(incrementSentCalls, 1);
    assert.deepEqual(incrementSentArgs, { notificationId: 'n1', ctaText: 'openA', linkRegistryId: 'l1' });
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
  }
});

test('testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  const prevEnvName = process.env.ENV_NAME;
  process.env.SERVICE_MODE = 'member';
  delete process.env.PHASE18_CTA_EXPERIMENT;
  delete process.env.ENV_NAME;

  let incrementSentArgs = null;

  const restore = [
    withPatched(deliveriesRepo, 'createDelivery', async () => ({ id: 'd1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({
      id: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    })),
    withPatched(phase18StatsRepo, 'incrementSent', async (args) => {
      incrementSentArgs = args;
      return { id: 'n1' };
    })
  ];

  try {
    const result = await testSendNotification({
      lineUserId: 'U1',
      text: 'hello',
      notificationId: 'n1',
      pushFn: async () => {}
    });
    assert.equal(result.id, 'd1');
    assert.deepEqual(incrementSentArgs, { notificationId: 'n1', ctaText: 'openA', linkRegistryId: 'l1' });
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
  }
});

test('testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  const prevEnvName = process.env.ENV_NAME;
  process.env.SERVICE_MODE = 'member';
  delete process.env.PHASE18_CTA_EXPERIMENT;
  process.env.ENV_NAME = 'stg';

  let incrementSentArgs = null;
  let incrementSentCalls = 0;

  const restore = [
    withPatched(deliveriesRepo, 'createDelivery', async () => ({ id: 'd1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({
      id: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    })),
    withPatched(phase18StatsRepo, 'incrementSent', async (args) => {
      incrementSentCalls += 1;
      incrementSentArgs = args;
      return { id: 'n1' };
    })
  ];

  try {
    const result = await testSendNotification({
      lineUserId: 'U1',
      text: 'hello',
      notificationId: 'n1',
      pushFn: async () => {}
    });
    assert.equal(result.id, 'd1');
    assert.equal(incrementSentCalls, 1);
    assert.deepEqual(incrementSentArgs, { notificationId: 'n1', ctaText: 'openA', linkRegistryId: 'l1' });
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
  }
});

test('testSendNotification: track mode records sent stats without experiment flag', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  const prevEnvName = process.env.ENV_NAME;
  process.env.SERVICE_MODE = 'track';
  delete process.env.PHASE18_CTA_EXPERIMENT;
  delete process.env.ENV_NAME;

  let incrementSentArgs = null;
  let incrementSentCalls = 0;

  const restore = [
    withPatched(deliveriesRepo, 'createDelivery', async () => ({ id: 'd1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({
      id: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    })),
    withPatched(phase18StatsRepo, 'incrementSent', async (args) => {
      incrementSentCalls += 1;
      incrementSentArgs = args;
      return { id: 'n1' };
    })
  ];

  try {
    const result = await testSendNotification({
      lineUserId: 'U1',
      text: 'hello',
      notificationId: 'n1',
      pushFn: async () => {}
    });
    assert.equal(result.id, 'd1');
    assert.equal(incrementSentCalls, 1);
    assert.deepEqual(incrementSentArgs, { notificationId: 'n1', ctaText: 'openA', linkRegistryId: 'l1' });
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
  }
});

test('phase18StatsRepo: incrementSent writes sentCount field', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'firebase-admin') {
      return {
        firestore: {
          FieldValue: {
            increment: (value) => ({ __increment: value })
          }
        }
      };
    }
    return originalLoad(request, parent, isMain);
  };

  try {
    await phase18StatsRepo.incrementSent({
      notificationId: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    });
    const doc = db._state.collections.phase18_cta_stats.docs.n1;
    assert.ok(doc);
    assert.ok(Object.prototype.hasOwnProperty.call(doc.data, 'sentCount'));
  } finally {
    Module._load = originalLoad;
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
