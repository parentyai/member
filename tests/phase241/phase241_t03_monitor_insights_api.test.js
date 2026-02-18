'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest,
  getDb
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const notificationsRepo = require('../../src/repos/firestore/notificationsRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const faqAnswerLogsRepo = require('../../src/repos/firestore/faqAnswerLogsRepo');

function httpRequest({ port, method, path, headers }) {
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
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  });

  const linkA = await linkRegistryRepo.createLink({
    title: 'Vendor A',
    url: 'https://vendor-a.example/path',
    vendorKey: 'vendor_a',
    vendorLabel: 'Vendor A'
  });
  const linkB = await linkRegistryRepo.createLink({
    title: 'Vendor B',
    url: 'https://fallback.example/path'
  });
  const n1 = await notificationsRepo.createNotification({
    title: 'N1',
    body: 'Body1',
    ctaText: 'Go',
    linkRegistryId: linkA.id,
    scenarioKey: 'A',
    stepKey: '3mo',
    status: 'active',
    target: { all: true }
  });
  const n2 = await notificationsRepo.createNotification({
    title: 'N2',
    body: 'Body2',
    ctaText: 'Go',
    linkRegistryId: linkB.id,
    scenarioKey: 'C',
    stepKey: 'week',
    status: 'active',
    target: { all: true }
  });

  await deliveriesRepo.createDeliveryWithId('d1', {
    notificationId: n1.id,
    lineUserId: 'U1',
    delivered: true,
    state: 'delivered',
    sentAt: new Date().toISOString(),
    clickAt: new Date().toISOString()
  });
  await deliveriesRepo.createDeliveryWithId('d2', {
    notificationId: n2.id,
    lineUserId: 'U2',
    delivered: true,
    state: 'delivered',
    sentAt: new Date().toISOString()
  });

  await getDb().collection('phase22_kpi_snapshots').doc('s1').set({
    createdAt: new Date().toISOString(),
    ctaA: 'A',
    ctaB: 'B',
    sentA: 100,
    clickA: 10,
    ctrA: 0.1,
    sentB: 100,
    clickB: 8,
    ctrB: 0.08,
    deltaCTR: 0.02
  });

  await faqAnswerLogsRepo.appendFaqAnswerLog({
    question: 'q1',
    matchedArticleIds: ['faq-1', 'faq-2'],
    createdAt: new Date().toISOString()
  });
  await faqAnswerLogsRepo.appendFaqAnswerLog({
    question: 'q2',
    matchedArticleIds: ['faq-1'],
    createdAt: new Date().toISOString()
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/monitor-insights?windowDays=7&limit=10',
    headers: { 'x-admin-token': 'test_admin_token', 'x-actor': 'phase241_test' }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.windowDays, 7);
  assert.ok(Array.isArray(body.vendorCtrTop));
  assert.ok(body.vendorCtrTop.some((item) => item.vendorLabel === 'Vendor A'));
  assert.ok(body.vendorCtrTop.some((item) => item.vendorLabel === 'fallback.example'));
  assert.ok(body.abSnapshot);
  assert.strictEqual(body.abSnapshot.ctaA, 'A');
  assert.ok(Array.isArray(body.faqReferenceTop));
  assert.strictEqual(body.faqReferenceTop[0].articleId, 'faq-1');
});
