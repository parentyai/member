'use strict';

const assert = require('assert');
const http = require('http');
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

test('security: system config notificationCaps roundtrip and fallback', async (t) => {
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

  const commonHeaders = {
    'x-admin-token': 'test_admin_token',
    'x-actor': 'admin_master',
    'x-trace-id': 'TRACE_CFG_CAP_1',
    'content-type': 'application/json; charset=utf-8'
  };

  // plan with caps
  const planRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: commonHeaders,
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: { perUserWeeklyCap: 3 }
    })
  });
  assert.strictEqual(planRes.status, 200);
  const plan = JSON.parse(planRes.body);
  assert.strictEqual(plan.ok, true);
  assert.deepStrictEqual(plan.notificationCaps, {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  const setRes = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/set',
    headers: commonHeaders,
    body: JSON.stringify({
      servicePhase: 2,
      notificationPreset: 'B',
      notificationCaps: { perUserWeeklyCap: 3 },
      planHash: plan.planHash,
      confirmToken: plan.confirmToken
    })
  });
  assert.strictEqual(setRes.status, 200);
  const setJson = JSON.parse(setRes.body);
  assert.strictEqual(setJson.ok, true);
  assert.deepStrictEqual(setJson.notificationCaps, {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  // plan/set without notificationCaps should keep current cap.
  const planRes2 = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/plan',
    headers: commonHeaders,
    body: JSON.stringify({
      servicePhase: 3,
      notificationPreset: 'C'
    })
  });
  assert.strictEqual(planRes2.status, 200);
  const plan2 = JSON.parse(planRes2.body);
  assert.strictEqual(plan2.ok, true);
  assert.deepStrictEqual(plan2.notificationCaps, {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });

  const setRes2 = await httpRequest({
    port,
    method: 'POST',
    path: '/api/admin/os/config/set',
    headers: commonHeaders,
    body: JSON.stringify({
      servicePhase: 3,
      notificationPreset: 'C',
      planHash: plan2.planHash,
      confirmToken: plan2.confirmToken
    })
  });
  assert.strictEqual(setRes2.status, 200);
  const setJson2 = JSON.parse(setRes2.body);
  assert.strictEqual(setJson2.ok, true);
  assert.deepStrictEqual(setJson2.notificationCaps, {
    perUserWeeklyCap: 3,
    perUserDailyCap: null,
    perCategoryWeeklyCap: null,
    quietHours: null
  });
});
