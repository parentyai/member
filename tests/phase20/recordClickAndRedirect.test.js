'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const ctaStatsRepo = require('../../src/repos/firestore/ctaStatsRepo');
const { recordClickAndRedirect } = require('../../src/usecases/track/recordClickAndRedirect');

function withPatched(obj, key, value) {
  const prev = obj[key];
  obj[key] = value;
  return () => {
    obj[key] = prev;
  };
}

test('recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  process.env.SERVICE_MODE = 'track';
  delete process.env.PHASE18_CTA_EXPERIMENT;

  let markClickCalled = false;
  let incrementClickCalled = false;

  const restore = [
    withPatched(linkRegistryRepo, 'getLink', async () => ({ url: 'https://example.com', lastHealth: { state: 'OK' } })),
    withPatched(deliveriesRepo, 'markClick', async () => {
      markClickCalled = true;
      return { id: 'd1' };
    }),
    withPatched(deliveriesRepo, 'getDelivery', async () => ({ id: 'd1', notificationId: 'n1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({ id: 'n1', ctaText: 'openA' })),
    withPatched(ctaStatsRepo, 'incrementClick', async () => {
      incrementClickCalled = true;
      return { id: 'n1' };
    })
  ];

  try {
    const result = await recordClickAndRedirect({ deliveryId: 'd1', linkRegistryId: 'l1' });
    assert.equal(result.url, 'https://example.com');
    assert.equal(markClickCalled, true);
    assert.equal(incrementClickCalled, true);
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
  }
});

test('recordClickAndRedirect: member mode does not record stats unless explicitly enabled', async () => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.PHASE18_CTA_EXPERIMENT;
  process.env.SERVICE_MODE = 'member';
  delete process.env.PHASE18_CTA_EXPERIMENT;

  const restore = [
    withPatched(linkRegistryRepo, 'getLink', async () => ({ url: 'https://example.com', lastHealth: { state: 'OK' } })),
    withPatched(deliveriesRepo, 'markClick', async () => ({ id: 'd1' })),
    withPatched(deliveriesRepo, 'getDelivery', async () => ({ id: 'd1', notificationId: 'n1' })),
    withPatched(notificationsRepo, 'getNotification', async () => ({ id: 'n1', ctaText: 'openA' })),
    withPatched(ctaStatsRepo, 'incrementClick', async () => {
      throw new Error('incrementClick should not be called');
    })
  ];

  try {
    const result = await recordClickAndRedirect({ deliveryId: 'd1', linkRegistryId: 'l1' });
    assert.equal(result.url, 'https://example.com');
  } finally {
    restore.reverse().forEach((fn) => fn());
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevFlag === undefined) delete process.env.PHASE18_CTA_EXPERIMENT;
    else process.env.PHASE18_CTA_EXPERIMENT = prevFlag;
  }
});

