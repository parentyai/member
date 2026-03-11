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
const eventsRepo = require('../../src/repos/firestore/eventsRepo');

function request({ port, method, path, headers }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers: headers || {} }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase250: vendor shadow admin API enforces admin token and returns compare read model', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await eventsRepo.createEvent({
    lineUserId: 'U_PHASE250_SHADOW_API',
    type: 'todo_vendor_shadow_scored',
    traceId: 'trace_phase250_shadow_api',
    requestId: 'req_phase250_shadow_api',
    ref: { todoKey: 'bank_open', sortApplied: false },
    shadow: {
      traceId: 'trace_phase250_shadow_api',
      currentOrderLinkIds: ['vendor_b', 'vendor_a'],
      rankedLinkIds: ['vendor_a', 'vendor_b'],
      items: [
        { linkId: 'vendor_a', relevanceScore: 110, explanationCodes: ['region_exact_match'] },
        { linkId: 'vendor_b', relevanceScore: 80, explanationCodes: ['region_mismatch'] }
      ]
    }
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

  const unauthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/vendors/shadow-relevance?lineUserId=U_PHASE250_SHADOW_API'
  });
  assert.strictEqual(unauthorized.status, 401);

  const authorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/vendors/shadow-relevance?lineUserId=U_PHASE250_SHADOW_API&todoKey=bank_open&limit=5',
    headers: {
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_shadow_api_test',
      'x-trace-id': 'trace_phase250_shadow_api_read'
    }
  });
  assert.strictEqual(authorized.status, 200);
  const payload = JSON.parse(authorized.body);
  assert.strictEqual(payload.ok, true);
  assert.ok(Array.isArray(payload.items));
  assert.strictEqual(payload.items.length, 1);
  assert.strictEqual(payload.items[0].lineUserId, 'U_PHASE250_SHADOW_API');
  assert.deepStrictEqual(payload.items[0].currentOrderLinkIds, ['vendor_b', 'vendor_a']);
  assert.deepStrictEqual(payload.items[0].rankedLinkIds, ['vendor_a', 'vendor_b']);
  assert.ok(Array.isArray(payload.items[0].scores));
  assert.strictEqual(payload.items[0].scores[0].linkId, 'vendor_a');
  assert.ok(payload.summary && typeof payload.summary === 'object');
  assert.strictEqual(payload.summary.totalEvents, 1);
  assert.strictEqual(payload.summary.sortAppliedCount, 0);
  assert.strictEqual(payload.summary.orderDivergenceCount, 1);
  assert.ok(Array.isArray(payload.summary.todoKeyDistribution));
  assert.strictEqual(payload.summary.todoKeyDistribution[0].todoKey, 'bank_open');
});
