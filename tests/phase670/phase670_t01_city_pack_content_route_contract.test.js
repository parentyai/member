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

test('phase670: city pack content route guards draft-only and create accepts slotContents fields', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase670_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await cityPacksRepo.createCityPack({
    id: 'cp_content_draft_670',
    name: 'Draft Pack 670',
    sourceRefs: ['sr_670_draft'],
    status: 'draft'
  });
  await cityPacksRepo.createCityPack({
    id: 'cp_content_active_670',
    name: 'Active Pack 670',
    sourceRefs: ['sr_670_active'],
    status: 'active'
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
    path: '/api/admin/city-packs/cp_content_draft_670/content',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'No Token' })
  });
  assert.strictEqual(noToken.status, 401);

  const activeRejected = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/cp_content_active_670/content',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase670_admin_token',
      'x-actor': 'phase670_test',
      'x-trace-id': 'trace_phase670_active_reject'
    },
    body: JSON.stringify({
      name: 'Should Reject',
      sourceRefs: ['sr_670_active'],
      slotContents: {
        emergency: {
          description: 'active edit',
          ctaText: 'open',
          linkRegistryId: 'lr_670_active'
        }
      }
    })
  });
  assert.strictEqual(activeRejected.status, 409);
  const activeBody = JSON.parse(activeRejected.body);
  assert.strictEqual(activeBody.error, 'city_pack_not_editable');

  const traceContentUpdate = 'trace_phase670_content_update';
  const draftUpdated = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/cp_content_draft_670/content',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase670_admin_token',
      'x-actor': 'phase670_test',
      'x-trace-id': traceContentUpdate
    },
    body: JSON.stringify({
      name: 'Draft Pack 670 Updated',
      description: 'updated description',
      sourceRefs: ['sr_670_draft', 'sr_670_new'],
      validUntil: '2026-12-31T00:00:00.000Z',
      packClass: 'regional',
      language: 'ja',
      slotSchemaVersion: 'city_pack_slot_v1',
      metadata: { regionKey: 'TX::austin', owner: 'ops' },
      slotContents: {
        emergency: {
          description: 'Emergency guidance',
          ctaText: 'Open emergency guide',
          linkRegistryId: 'lr_670_emergency',
          sourceRefs: ['sr_670_draft']
        }
      }
    })
  });
  assert.strictEqual(draftUpdated.status, 200);
  const updateBody = JSON.parse(draftUpdated.body);
  assert.strictEqual(updateBody.ok, true);

  const updatedPack = await cityPacksRepo.getCityPack('cp_content_draft_670');
  assert.strictEqual(updatedPack.name, 'Draft Pack 670 Updated');
  assert.deepStrictEqual(updatedPack.sourceRefs, ['sr_670_draft', 'sr_670_new']);
  assert.strictEqual(updatedPack.slotSchemaVersion, 'city_pack_slot_v1');
  assert.strictEqual(updatedPack.metadata.regionKey, 'TX::austin');
  assert.strictEqual(updatedPack.metadata.owner, 'ops');
  assert.ok(updatedPack.slotContents && updatedPack.slotContents.emergency);
  assert.strictEqual(updatedPack.slotContents.emergency.linkRegistryId, 'lr_670_emergency');

  const contentLogs = await auditLogsRepo.listAuditLogsByTraceId(traceContentUpdate, 20);
  assert.ok(contentLogs.some((item) => item.action === 'city_pack.content.update'));

  const traceCreate = 'trace_phase670_create_ext';
  const createRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase670_admin_token',
      'x-actor': 'phase670_test',
      'x-trace-id': traceCreate
    },
    body: JSON.stringify({
      id: 'cp_create_ext_670',
      name: 'Create Extended 670',
      sourceRefs: ['sr_670_create'],
      requestId: 'req_670_create',
      templateRefs: ['tpl_670_a', 'tpl_670_b'],
      slotSchemaVersion: 'city_pack_slot_v1',
      slotContents: {
        admin: {
          description: 'Admin office',
          ctaText: 'Open office info',
          linkRegistryId: 'lr_670_admin',
          sourceRefs: ['sr_670_create']
        }
      },
      packClass: 'regional',
      language: 'ja',
      metadata: { regionKey: 'TX::austin' }
    })
  });
  assert.strictEqual(createRes.status, 201);

  const createdPack = await cityPacksRepo.getCityPack('cp_create_ext_670');
  assert.ok(createdPack);
  assert.strictEqual(createdPack.requestId, 'req_670_create');
  assert.deepStrictEqual(createdPack.templateRefs, ['tpl_670_a', 'tpl_670_b']);
  assert.strictEqual(createdPack.slotSchemaVersion, 'city_pack_slot_v1');
  assert.ok(createdPack.slotContents && createdPack.slotContents.admin);
  assert.strictEqual(createdPack.slotContents.admin.linkRegistryId, 'lr_670_admin');

  const createLogs = await auditLogsRepo.listAuditLogsByTraceId(traceCreate, 20);
  const createLog = createLogs.find((item) => item.action === 'city_pack.create');
  assert.ok(createLog);
  assert.strictEqual(createLog.payloadSummary.slotContentCount, 1);
});
