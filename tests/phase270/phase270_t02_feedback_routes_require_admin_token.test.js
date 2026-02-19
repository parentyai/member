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
const cityPackFeedbackRepo = require('../../src/repos/firestore/cityPackFeedbackRepo');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('phase270: city-pack-feedback routes require admin token', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase270_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevServiceMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevServiceMode;
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  await cityPackFeedbackRepo.createFeedback({
    lineUserId: 'line_u_feedback',
    feedbackText: 'City Pack Feedback: map is outdated',
    traceId: 'trace_feedback'
  });

  const noToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-feedback'
  });
  assert.strictEqual(noToken.status, 401);

  const withToken = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-feedback?limit=10',
    headers: {
      'x-admin-token': 'phase270_admin_token',
      'x-actor': 'phase270_test'
    }
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
});
