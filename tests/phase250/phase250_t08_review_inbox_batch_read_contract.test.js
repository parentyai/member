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
const sourceEvidenceRepo = require('../../src/repos/firestore/sourceEvidenceRepo');
const cityPacksRepo = require('../../src/repos/firestore/cityPacksRepo');

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

test('phase250: review inbox batch-read keeps response shape and reduces duplicate reads', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevBatchFlag = process.env.ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';
  process.env.ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1 = '1';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await cityPacksRepo.createCityPack({
    id: 'cp_batch_ja',
    name: 'Tokyo',
    status: 'draft',
    sourceRefs: ['sr_batch_1', 'sr_batch_2', 'sr_batch_3'],
    packClass: 'regional',
    language: 'ja'
  });
  await cityPacksRepo.createCityPack({
    id: 'cp_batch_en',
    name: 'Tokyo EN',
    status: 'draft',
    sourceRefs: ['sr_batch_1', 'sr_batch_3'],
    packClass: 'regional',
    language: 'en'
  });
  await sourceEvidenceRepo.createEvidence({
    id: 'se_batch_001',
    sourceRefId: 'sr_batch_1',
    checkedAt: '2026-03-01T00:00:00.000Z',
    result: 'ok',
    traceId: 'trace_batch_review_001'
  });
  await sourceEvidenceRepo.createEvidence({
    id: 'se_batch_002',
    sourceRefId: 'sr_batch_3',
    checkedAt: '2026-03-01T00:01:00.000Z',
    result: 'diff_detected',
    traceId: 'trace_batch_review_001'
  });
  await sourceRefsRepo.createSourceRef({
    id: 'sr_batch_1',
    url: 'https://example.com/sr_batch_1',
    status: 'needs_review',
    usedByCityPackIds: ['cp_batch_ja', 'cp_batch_en'],
    evidenceLatestId: 'se_batch_001'
  });
  await sourceRefsRepo.createSourceRef({
    id: 'sr_batch_2',
    url: 'https://example.com/sr_batch_2',
    status: 'needs_review',
    usedByCityPackIds: ['cp_batch_ja'],
    evidenceLatestId: 'se_batch_001'
  });
  await sourceRefsRepo.createSourceRef({
    id: 'sr_batch_3',
    url: 'https://example.com/sr_batch_3',
    status: 'needs_review',
    usedByCityPackIds: ['cp_batch_ja', 'cp_batch_en'],
    evidenceLatestId: 'se_batch_002'
  });

  const originalGetCityPack = cityPacksRepo.getCityPack;
  const originalGetEvidence = sourceEvidenceRepo.getEvidence;
  let cityPackReads = 0;
  let evidenceReads = 0;
  cityPacksRepo.getCityPack = async (...args) => {
    cityPackReads += 1;
    return originalGetCityPack(...args);
  };
  sourceEvidenceRepo.getEvidence = async (...args) => {
    evidenceReads += 1;
    return originalGetEvidence(...args);
  };

  const { createServer } = require('../../src/index');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    cityPacksRepo.getCityPack = originalGetCityPack;
    sourceEvidenceRepo.getEvidence = originalGetEvidence;
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevBatchFlag === undefined) delete process.env.ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1;
    else process.env.ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1 = prevBatchFlag;
  });

  const batchOn = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox?status=needs_review&limit=20',
    headers: {
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_batch_test',
      'x-trace-id': 'trace_phase250_batch_on'
    }
  });
  assert.strictEqual(batchOn.status, 200);
  const bodyOn = JSON.parse(batchOn.body);
  assert.strictEqual(bodyOn.ok, true);
  assert.ok(Array.isArray(bodyOn.items));
  assert.strictEqual(bodyOn.items.length, 3);
  assert.ok(bodyOn.items.every((item) => Object.prototype.hasOwnProperty.call(item, 'sourceRefId')));
  assert.ok(bodyOn.items.every((item) => Object.prototype.hasOwnProperty.call(item, 'evidenceLatestId')));
  const readsOn = { cityPackReads, evidenceReads };
  assert.ok(readsOn.cityPackReads <= 2);
  assert.ok(readsOn.evidenceReads <= 2);

  cityPackReads = 0;
  evidenceReads = 0;
  process.env.ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1 = '0';
  const batchOff = await request({
    port,
    method: 'GET',
    path: '/api/admin/review-inbox?status=needs_review&limit=20',
    headers: {
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_batch_test',
      'x-trace-id': 'trace_phase250_batch_off'
    }
  });
  assert.strictEqual(batchOff.status, 200);
  const bodyOff = JSON.parse(batchOff.body);
  assert.strictEqual(bodyOff.ok, true);
  assert.ok(Array.isArray(bodyOff.items));
  assert.strictEqual(bodyOff.items.length, 3);
  assert.ok(cityPackReads > readsOn.cityPackReads);
  assert.ok(evidenceReads > readsOn.evidenceReads);
});
