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
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

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

test('phase266: city pack structure update route requires admin token and appends audit', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase266_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await cityPacksRepo.createCityPack({
    id: 'cp_route_266',
    name: 'Route Structure',
    sourceRefs: ['sr_route_266']
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

  const noToken = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/cp_route_266/structure',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetingRules: [], slots: [] })
  });
  assert.strictEqual(noToken.status, 401);

  const traceId = 'trace_phase266_structure_route';
  const withToken = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/cp_route_266/structure',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase266_admin_token',
      'x-actor': 'phase266_test',
      'x-trace-id': traceId
    },
    body: JSON.stringify({
      targetingRules: [{ field: 'regionKey', op: 'eq', value: 'TX::austin' }],
      slots: [{ slotId: 'core', status: 'active' }]
    })
  });
  assert.strictEqual(withToken.status, 200);
  const body = JSON.parse(withToken.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.targetingRuleCount, 1);
  assert.strictEqual(body.slotCount, 1);

  const updated = await cityPacksRepo.getCityPack('cp_route_266');
  assert.strictEqual(Array.isArray(updated.targetingRules), true);
  assert.strictEqual(updated.targetingRules.length, 1);
  assert.strictEqual(Array.isArray(updated.slots), true);
  assert.strictEqual(updated.slots.length, 1);

  const logs = await auditLogsRepo.listAuditLogsByTraceId(traceId, 20);
  assert.ok(logs.some((item) => item.action === 'city_pack.structure.update'));
});
