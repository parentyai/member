'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const usersRepo = require('../../src/repos/firestore/usersRepo');
const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
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

test('security: system config impactPreview includes cap breakdown fields', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await usersRepo.createUser('U1', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null
  });
  await deliveriesRepo.createDeliveryWithId('d1', {
    lineUserId: 'U1',
    delivered: true,
    sentAt: '2026-02-10T01:00:00.000Z',
    deliveredAt: '2026-02-10T01:00:00.000Z',
    notificationCategory: 'DEADLINE_REQUIRED'
  });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevSecret;
  });

  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'admin_master',
      'x-trace-id': 'TRACE_CFG_IMPACT_1',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: {
        perCategoryWeeklyCap: 1
      }
    })
  });

  assert.strictEqual(res.status, 200);
  const json = JSON.parse(res.body);
  assert.strictEqual(json.ok, true);
  assert.ok(json.impactPreview);
  assert.ok(typeof json.impactPreview.sampledEvaluations === 'number');
  assert.ok(json.impactPreview.blockedByCapType);
  assert.ok(json.impactPreview.blockedByCategory);
  assert.ok(json.impactPreview.blockedByReason);
  assert.ok(typeof json.impactPreview.blockedEvaluations === 'number');
  assert.ok(typeof json.impactPreview.blockedEvaluationRatePercent === 'number');
  assert.ok(typeof json.impactPreview.estimatedBlockedUserRatePercent === 'number');
});

test('security: system config plan succeeds when notificationCaps are all null', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevSecret;
  });

  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'admin_master',
      'x-trace-id': 'TRACE_CFG_IMPACT_NULL_CAPS',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      servicePhase: null,
      notificationPreset: null,
      notificationCaps: {
        perUserWeeklyCap: null,
        perUserDailyCap: null,
        perCategoryWeeklyCap: null,
        quietHours: null
      }
    })
  });

  assert.strictEqual(res.status, 200);
  const json = JSON.parse(res.body);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(json.impactPreview.sampledUsers, 0);
  assert.strictEqual(json.impactPreview.sampledEvaluations, 0);
  assert.strictEqual(json.impactPreview.blockedEvaluations, 0);
  assert.strictEqual(json.impactPreview.blockedEvaluationRatePercent, 0);
  assert.strictEqual(json.impactPreview.estimatedBlockedUserRatePercent, 0);
  assert.deepStrictEqual(json.impactPreview.blockedByCapType, {});
  assert.deepStrictEqual(json.impactPreview.blockedByCategory, {});
  assert.deepStrictEqual(json.impactPreview.blockedByReason, {});
});

test('security: system config impactPreview respects deliveryCountLegacyFallback mode', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await usersRepo.createUser('U_LEGACY', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null
  });
  await deliveriesRepo.createDeliveryWithId('legacy_no_delivered_at', {
    lineUserId: 'U_LEGACY',
    delivered: true,
    sentAt: new Date().toISOString(),
    deliveredAt: null
  });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevSecret;
  });

  const headers = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'content-type': 'application/json; charset=utf-8'
  };

  const planDeliveredAtOnlyRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: Object.assign({}, headers, { 'x-trace-id': 'TRACE_CFG_IMPACT_DELIVERED_ONLY' }),
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: { perUserWeeklyCap: 1 },
      deliveryCountLegacyFallback: false
    })
  });
  assert.strictEqual(planDeliveredAtOnlyRes.status, 200);
  const planDeliveredAtOnly = JSON.parse(planDeliveredAtOnlyRes.body);
  assert.strictEqual(planDeliveredAtOnly.ok, true);
  assert.strictEqual(planDeliveredAtOnly.impactPreview.estimatedBlockedUsers, 0);

  const planLegacyFallbackRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: Object.assign({}, headers, { 'x-trace-id': 'TRACE_CFG_IMPACT_LEGACY_FALLBACK' }),
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: { perUserWeeklyCap: 1 },
      deliveryCountLegacyFallback: true
    })
  });
  assert.strictEqual(planLegacyFallbackRes.status, 200);
  const planLegacyFallback = JSON.parse(planLegacyFallbackRes.body);
  assert.strictEqual(planLegacyFallback.ok, true);
  assert.strictEqual(planLegacyFallback.impactPreview.estimatedBlockedUsers, 1);
  assert.ok(planLegacyFallback.impactPreview.blockedByCapType.PER_USER_WEEKLY >= 1);
});

test('security: system config impactPreview skips delivery counters during active quietHours', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.OPS_CONFIRM_TOKEN_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.OPS_CONFIRM_TOKEN_SECRET = 'test_confirm_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await usersRepo.createUser('U_QUIET_1', {
    createdAt: '2026-02-10T00:00:00.000Z',
    scenarioKey: 'A',
    stepKey: 'THREE_MONTHS',
    memberNumber: null
  });

  let counterCalls = 0;
  const originalSnapshot = deliveriesRepo.getDeliveredCountsSnapshot;
  deliveriesRepo.getDeliveredCountsSnapshot = async () => {
    counterCalls += 1;
    throw new Error('delivery counters should not be called during quiet hours preview');
  };

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    deliveriesRepo.getDeliveredCountsSnapshot = originalSnapshot;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.OPS_CONFIRM_TOKEN_SECRET;
    else process.env.OPS_CONFIRM_TOKEN_SECRET = prevSecret;
  });

  const nowHour = new Date().getUTCHours();
  const endHour = (nowHour + 1) % 24;
  const res = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'admin_master',
      'x-trace-id': 'TRACE_CFG_IMPACT_QUIET_HOURS_SKIP_COUNTS',
      'content-type': 'application/json; charset=utf-8'
    },
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: {
        perUserWeeklyCap: 3,
        quietHours: { startHourUtc: nowHour, endHourUtc: endHour }
      }
    })
  });

  assert.strictEqual(res.status, 200);
  const json = JSON.parse(res.body);
  assert.strictEqual(json.ok, true);
  assert.strictEqual(counterCalls, 0);
  assert.strictEqual(json.impactPreview.sampledUsers, 1);
  assert.strictEqual(json.impactPreview.blockedEvaluations, 1);
  assert.strictEqual(json.impactPreview.blockedByCapType.QUIET_HOURS, 1);
  assert.strictEqual(json.impactPreview.blockedByReason.quiet_hours_active, 1);
  assert.strictEqual(json.impactPreview.blockedByCategory.UNCATEGORIZED, 1);
});
