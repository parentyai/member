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
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

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

test('phase268: review inbox exposes priority/confidence/audit stage and sorts by priority', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase268_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceRefsRepo.createSourceRef({
    id: 'sr_priority_high',
    url: 'https://example.com/high',
    status: 'dead',
    validUntil: '2020-01-01T00:00:00.000Z',
    riskLevel: 'high',
    requiredLevel: 'required',
    confidenceScore: 12,
    lastAuditStage: 'heavy'
  });
  await sourceRefsRepo.createSourceRef({
    id: 'sr_priority_low',
    url: 'https://example.com/low',
    status: 'active',
    validUntil: '2099-01-01T00:00:00.000Z',
    riskLevel: 'low',
    requiredLevel: 'optional',
    confidenceScore: 95,
    lastAuditStage: 'light'
  });

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

  const res = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox?limit=10',
    headers: {
      'x-admin-token': 'phase268_admin_token',
      'x-actor': 'phase268_test',
      'x-trace-id': 'trace_phase268_priority'
    }
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.strictEqual(body.items[0].sourceRefId, 'sr_priority_high');
  assert.ok(body.items[0].priorityScore >= body.items[1].priorityScore);
  assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(body.items[0].priorityLevel));
  assert.ok(Object.prototype.hasOwnProperty.call(body.items[0], 'confidenceScore'));
  assert.ok(Object.prototype.hasOwnProperty.call(body.items[0], 'lastAuditStage'));
});
