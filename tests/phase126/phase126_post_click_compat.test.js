'use strict';

const assert = require('assert');
const http = require('http');
const Module = require('module');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function httpRequest({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function stubFirebaseAdminIncrement() {
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
  return () => { Module._load = originalLoad; };
}

test('phase126: existing POST /track/click still redirects and records clickAt', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.TRACK_POST_CLICK_ENABLED;
  process.env.SERVICE_MODE = 'track';
  delete process.env.TRACK_POST_CLICK_ENABLED;

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const restoreAdminStub = stubFirebaseAdminIncrement();

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    restoreAdminStub();
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevFlag === undefined) delete process.env.TRACK_POST_CLICK_ENABLED;
    else process.env.TRACK_POST_CLICK_ENABLED = prevFlag;
  });

  await db.collection('link_registry').doc('l1').set({ url: 'https://example.com', createdAt: 1 });
  await db.collection('notifications').doc('n1').set({
    title: 't',
    body: 'b',
    ctaText: 'openA',
    linkRegistryId: 'l1',
    createdAt: 1
  });

  const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true
  });

  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/track/click',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryId: delivery.id, linkRegistryId: 'l1' })
  });

  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.location, 'https://example.com');

  const deliveryDoc = db._state.collections.notification_deliveries.docs[delivery.id];
  assert.ok(deliveryDoc);
  assert.strictEqual(deliveryDoc.data.clickAt, 'SERVER_TIMESTAMP');

  const statsDoc = db._state.collections.phase18_cta_stats.docs.n1;
  assert.ok(statsDoc);
  assert.ok(Object.prototype.hasOwnProperty.call(statsDoc.data, 'clickCount'));
});

test('phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevFlag = process.env.TRACK_POST_CLICK_ENABLED;
  process.env.SERVICE_MODE = 'track';
  process.env.TRACK_POST_CLICK_ENABLED = '0';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const restoreAdminStub = stubFirebaseAdminIncrement();

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    restoreAdminStub();
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevFlag === undefined) delete process.env.TRACK_POST_CLICK_ENABLED;
    else process.env.TRACK_POST_CLICK_ENABLED = prevFlag;
  });

  await db.collection('link_registry').doc('l1').set({ url: 'https://example.com', createdAt: 1 });
  await db.collection('notifications').doc('n1').set({
    title: 't',
    body: 'b',
    ctaText: 'openA',
    linkRegistryId: 'l1',
    createdAt: 1
  });

  const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U1',
    delivered: true
  });

  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/track/click',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryId: delivery.id, linkRegistryId: 'l1' })
  });

  assert.strictEqual(res.status, 403);
  const deliveryDoc = db._state.collections.notification_deliveries.docs[delivery.id];
  assert.ok(deliveryDoc);
  assert.strictEqual(deliveryDoc.data.clickAt, undefined);
  assert.ok(!db._state.collections.phase18_cta_stats);
});
