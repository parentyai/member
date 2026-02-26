'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  getDb,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');

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

function listDocs(collection) {
  const col = getDb()._state.collections[collection];
  if (!col) return [];
  return Object.entries(col.docs).map(([id, row]) => {
    const payload = row && row.data && typeof row.data === 'object' ? row.data : row;
    return Object.assign({ id }, payload);
  });
}

test('phase668: city-pack-education-links routes require admin token and persist sourceRef/calendarLink with trace', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase668_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const publicLink = await linkRegistryRepo.createLink({
    title: 'Public School Calendar',
    url: 'https://example.org/public-school-calendar',
    domainClass: 'school_public',
    schoolType: 'public',
    eduScope: 'calendar',
    regionKey: 'ny::new-york',
    tags: ['education', 'calendar', 'public']
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

  const unauthorized = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-education-links'
  });
  assert.strictEqual(unauthorized.status, 401);

  const createdRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-education-links',
    headers: {
      'x-admin-token': 'phase668_admin_token',
      'x-actor': 'phase668_test',
      'x-trace-id': 'trace_phase668_education_create',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      regionKey: 'NY::New-York',
      schoolYear: '2025-2026',
      linkRegistryId: publicLink.id,
      usedByCityPackIds: ['cp_phase668_school_1']
    })
  });
  assert.strictEqual(createdRes.status, 201);
  const createdBody = JSON.parse(createdRes.body);
  assert.strictEqual(createdBody.ok, true);
  assert.ok(createdBody.schoolCalendarLinkId);
  assert.ok(createdBody.sourceRefId);

  const listedRes = await request({
    port,
    method: 'GET',
    path: '/api/admin/city-pack-education-links?regionKey=ny::new-york&status=active&limit=10',
    headers: {
      'x-admin-token': 'phase668_admin_token',
      'x-actor': 'phase668_test',
      'x-trace-id': 'trace_phase668_education_list'
    }
  });
  assert.strictEqual(listedRes.status, 200);
  const listedBody = JSON.parse(listedRes.body);
  assert.strictEqual(listedBody.ok, true);
  assert.strictEqual(Array.isArray(listedBody.items), true);
  assert.strictEqual(listedBody.items.length, 1);
  assert.strictEqual(listedBody.items[0].link.schoolType, 'public');
  assert.strictEqual(listedBody.items[0].sourceRef.status, 'needs_review');

  const sourceRefs = listDocs('source_refs');
  assert.strictEqual(sourceRefs.length, 1);
  assert.deepStrictEqual(sourceRefs[0].usedByCityPackIds, ['cp_phase668_school_1']);

  const calendarLinks = listDocs('school_calendar_links');
  assert.strictEqual(calendarLinks.length, 1);
  assert.strictEqual(calendarLinks[0].traceId, 'trace_phase668_education_create');
  assert.strictEqual(calendarLinks[0].status, 'active');

  const logs = listDocs('audit_logs');
  assert.ok(logs.some((item) => item.action === 'city_pack.education_link.create' && item.traceId === 'trace_phase668_education_create'));
});
