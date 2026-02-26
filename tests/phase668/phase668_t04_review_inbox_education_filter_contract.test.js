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

test('phase668: review-inbox supports schoolType/eduScope/regionKey filters', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase668_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await sourceRefsRepo.createSourceRef({
    id: 'sr_phase668_public_calendar',
    url: 'https://example.com/public-calendar',
    status: 'needs_review',
    schoolType: 'public',
    eduScope: 'calendar',
    regionKey: 'ny::new-york',
    validUntil: '2026-06-30T00:00:00.000Z'
  });
  await sourceRefsRepo.createSourceRef({
    id: 'sr_phase668_private_calendar',
    url: 'https://example.com/private-calendar',
    status: 'needs_review',
    schoolType: 'private',
    eduScope: 'calendar',
    regionKey: 'ny::new-york',
    validUntil: '2026-06-30T00:00:00.000Z'
  });

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

  const res = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox?status=needs_review&schoolType=public&eduScope=calendar&regionKey=ny::new-york&limit=50',
    headers: {
      'x-admin-token': 'phase668_admin_token',
      'x-actor': 'phase668_test',
      'x-trace-id': 'trace_phase668_review_filter'
    }
  });
  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(Array.isArray(body.items), true);
  assert.strictEqual(body.items.length, 1);
  assert.strictEqual(body.items[0].sourceRefId, 'sr_phase668_public_calendar');
  assert.strictEqual(body.items[0].schoolType, 'public');
  assert.strictEqual(body.items[0].eduScope, 'calendar');
  assert.strictEqual(body.items[0].regionKey, 'ny::new-york');
});
