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
  const db = getDb();
  const col = db._state.collections[collection];
  if (!col) return [];
  return Object.entries(col.docs).map(([id, row]) => {
    const payload = row && row.data && typeof row.data === 'object' ? row.data : row;
    return Object.assign({ id }, payload);
  });
}

test('phase666: municipality schools import internal job requires token and upserts public rows', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase666_job_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const sourceLink = await linkRegistryRepo.createLink({
    title: 'District Source',
    url: 'https://example.org/district',
    schoolType: 'public',
    domainClass: 'k12_district',
    eduScope: 'district_info'
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
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  });

  const unauthorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/municipality-schools-import',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ rows: [] })
  });
  assert.strictEqual(unauthorized.status, 401);

  const authorized = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/municipality-schools-import',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase666_job_token',
      'x-trace-id': 'trace_phase666_import'
    },
    body: JSON.stringify({
      rows: [{
        regionKey: 'TX::Austin',
        name: 'Austin Public School',
        district: 'Austin ISD',
        sourceLinkRegistryId: sourceLink.id
      }]
    })
  });
  assert.strictEqual(authorized.status, 200);
  const body = JSON.parse(authorized.body);
  assert.strictEqual(body.succeeded, 1);
  assert.strictEqual(body.failed, 0);
  assert.strictEqual(body.traceId, 'trace_phase666_import');

  const schools = listDocs('municipality_schools');
  assert.strictEqual(schools.length, 1);
  assert.strictEqual(schools[0].type, 'public');
  assert.strictEqual(schools[0].sourceLinkRegistryId, sourceLink.id);
  assert.strictEqual(schools[0].traceId, 'trace_phase666_import');

  const logs = listDocs('audit_logs');
  assert.ok(logs.some((item) => item.action === 'city_pack.education.municipality_schools_import'));

  const privateRejected = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/municipality-schools-import',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase666_job_token',
      'x-trace-id': 'trace_phase666_import_private_reject'
    },
    body: JSON.stringify({
      rows: [{
        regionKey: 'TX::Austin',
        name: 'Private Sample',
        district: 'Austin ISD',
        sourceLinkRegistryId: sourceLink.id,
        type: 'private'
      }]
    })
  });
  assert.strictEqual(privateRejected.status, 200);
  const privateBody = JSON.parse(privateRejected.body);
  assert.strictEqual(privateBody.succeeded, 0);
  assert.strictEqual(privateBody.failed, 1);
  assert.ok(Array.isArray(privateBody.errors) && privateBody.errors.some((item) => String(item.message || '').includes('school type must be public')));
  assert.strictEqual(listDocs('municipality_schools').length, 1);
});
