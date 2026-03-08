'use strict';

const assert = require('node:assert/strict');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function createFreshServer() {
  const indexPath = require.resolve('../../src/index');
  const routePath = require.resolve('../../src/routes/admin/emergencyLayer');
  delete require.cache[indexPath];
  delete require.cache[routePath];
  return require('../../src/index').createServer();
}

test('phase750: emergency approve route returns 207 on partial send result', async (t) => {
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase750_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const approveModule = require('../../src/usecases/emergency/approveEmergencyBulletin');
  const originalApprove = approveModule.approveEmergencyBulletin;
  approveModule.approveEmergencyBulletin = async () => ({
    ok: false,
    partial: true,
    reason: 'send_partial_failure',
    bulletinId: 'emb_phase750_partial',
    deliveredCount: 3
  });

  const server = createFreshServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    approveModule.approveEmergencyBulletin = originalApprove;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/api/admin/emergency/bulletins/emb_phase750_partial/approve',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase750_admin_token',
      'x-actor': 'phase750_admin',
      'x-trace-id': 'trace_phase750_partial'
    },
    body: JSON.stringify({})
  });

  assert.equal(res.status, 207);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.partial, true);
  assert.equal(payload.reason, 'send_partial_failure');
});
