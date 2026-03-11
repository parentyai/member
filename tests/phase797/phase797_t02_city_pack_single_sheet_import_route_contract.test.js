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

function buildSingleSheetPayload() {
  return {
    templateName: 'SingleSheet NY Pack',
    singleSheet: {
      headers: [
        'row_id',
        'row_type',
        'canonical_key',
        'status',
        'source_ids_json',
        'city_pack_module_key',
        'view_type',
        'title_short',
        'summary_md'
      ],
      rows: [
        {
          row_id: 'r1',
          row_type: 'VIEW',
          canonical_key: 'cp::ny::housing',
          status: 'active',
          source_ids_json: '["sr_1","sr_2"]',
          city_pack_module_key: 'housing',
          view_type: 'city_pack',
          title_short: 'NY Housing',
          summary_md: 'housing summary'
        },
        {
          row_id: 'r2',
          row_type: 'TASK',
          canonical_key: 'task::open_bank',
          status: 'active',
          source_ids_json: '[]',
          city_pack_module_key: 'housing',
          view_type: '',
          title_short: '',
          summary_md: ''
        }
      ]
    }
  };
}

test('phase797: city pack import dry-run/apply supports singleSheet payload adapter', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase797_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

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
    method: 'POST',
    path: '/api/admin/city-packs/import/dry-run',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildSingleSheetPayload())
  });
  assert.strictEqual(unauthorized.status, 401);

  const dryRun = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/import/dry-run',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase797_admin_token',
      'x-actor': 'phase797_import_test',
      'x-trace-id': 'trace_phase797_dry_run'
    },
    body: JSON.stringify(buildSingleSheetPayload())
  });
  assert.strictEqual(dryRun.status, 200);
  const dryRunPayload = JSON.parse(dryRun.body);
  assert.strictEqual(dryRunPayload.ok, true);
  assert.ok(typeof dryRunPayload.planHash === 'string' && dryRunPayload.planHash.length > 10);
  assert.ok(typeof dryRunPayload.confirmToken === 'string' && dryRunPayload.confirmToken.length > 10);
  assert.deepStrictEqual(dryRunPayload.normalizedTemplate.modules, ['housing']);
  assert.strictEqual(dryRunPayload.normalizedTemplate.recommendedTasks.length, 1);

  const applyPayload = Object.assign({}, buildSingleSheetPayload(), {
    planHash: dryRunPayload.planHash,
    confirmToken: dryRunPayload.confirmToken
  });
  const apply = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-packs/import/apply',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase797_admin_token',
      'x-actor': 'phase797_import_test',
      'x-trace-id': 'trace_phase797_apply'
    },
    body: JSON.stringify(applyPayload)
  });
  assert.strictEqual(apply.status, 201);
  const applyResult = JSON.parse(apply.body);
  assert.strictEqual(applyResult.ok, true);
  assert.ok(typeof applyResult.cityPackId === 'string' && applyResult.cityPackId.length > 0);

  const detail = await request({
    port,
    method: 'GET',
    path: `/api/admin/city-packs/${encodeURIComponent(applyResult.cityPackId)}`,
    headers: {
      'x-admin-token': 'phase797_admin_token',
      'x-actor': 'phase797_import_test',
      'x-trace-id': 'trace_phase797_detail'
    }
  });
  assert.strictEqual(detail.status, 200);
  const detailPayload = JSON.parse(detail.body);
  assert.strictEqual(detailPayload.ok, true);
  assert.deepStrictEqual(detailPayload.item.modules, ['housing']);
  assert.strictEqual(Array.isArray(detailPayload.item.recommendedTasks), true);
});
