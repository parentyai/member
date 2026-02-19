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

function postJson({ port, path, body, token }) {
  return request({
    port,
    method: 'POST',
    path,
    headers: {
      'x-admin-token': token,
      'x-actor': 'phase271_test',
      'x-trace-id': 'trace_phase271',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body || {})
  });
}

test('phase271: update proposal allowlist enforced and apply updates city pack', async (t) => {
  const prevServiceMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  if (prevServiceMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase271_admin_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await cityPacksRepo.createCityPack({
    id: 'cp_phase271',
    name: 'Phase271 Pack',
    sourceRefs: ['sr_phase271'],
    templateRefs: [],
    rules: [],
    targetingRules: [],
    slots: []
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

  const invalidRes = await postJson({
    port,
    token: 'phase271_admin_token',
    path: '/api/admin/city-pack-update-proposals',
    body: {
      cityPackId: 'cp_phase271',
      summary: 'invalid patch',
      proposalPatch: { rules: [] }
    }
  });
  assert.strictEqual(invalidRes.status, 400);

  const createRes = await postJson({
    port,
    token: 'phase271_admin_token',
    path: '/api/admin/city-pack-update-proposals',
    body: {
      cityPackId: 'cp_phase271',
      summary: 'metadata update',
      proposalPatch: { metadata: { note: 'phase271' } }
    }
  });
  assert.strictEqual(createRes.status, 201);
  const created = JSON.parse(createRes.body);
  assert.ok(created.proposalId);

  const approveRes = await postJson({
    port,
    token: 'phase271_admin_token',
    path: `/api/admin/city-pack-update-proposals/${encodeURIComponent(created.proposalId)}/approve`,
    body: {}
  });
  assert.strictEqual(approveRes.status, 200);

  const applyRes = await postJson({
    port,
    token: 'phase271_admin_token',
    path: `/api/admin/city-pack-update-proposals/${encodeURIComponent(created.proposalId)}/apply`,
    body: {}
  });
  assert.strictEqual(applyRes.status, 200);

  const updated = await cityPacksRepo.getCityPack('cp_phase271');
  assert.ok(updated);
  assert.strictEqual(updated.metadata && updated.metadata.note, 'phase271');
});
