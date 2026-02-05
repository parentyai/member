'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const phase18StatsRepo = require('../../src/repos/firestore/phase18StatsRepo');
const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');

function withPatched(obj, key, value) {
  const prev = obj[key];
  obj[key] = value;
  return () => {
    obj[key] = prev;
  };
}

test('testSendNotification: member mode records sent stats only when PHASE18_CTA_EXPERIMENT=1', async () => {
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

test('testSendNotification: member mode does not record sent stats when PHASE18_CTA_EXPERIMENT is not enabled', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  const prevEnvName = process.env.ENV_NAME;
  process.env.SERVICE_MODE = 'member';
  delete process.env.PHASE18_CTA_EXPERIMENT;
  delete process.env.ENV_NAME;

  const restore = [
    withPatched(deliveriesRepo, 'createDelivery', async () => ({ id: 'd1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({
      id: 'n1',
      ctaText: 'openA',
      linkRegistryId: 'l1'
    })),
    withPatched(phase18StatsRepo, 'incrementSent', async () => {
      throw new Error('incrementSent should not be called');
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
