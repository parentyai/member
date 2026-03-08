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
const cityPackRequestsRepo = require('../../src/repos/firestore/cityPackRequestsRepo');

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

test('phase250: extended city-pack auth contracts keep admin/internal token boundaries', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevJobToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';
  process.env.CITY_PACK_JOB_TOKEN = 'phase250_job_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await cityPackRequestsRepo.createRequest({
    id: 'cpr_phase250_auth_001',
    status: 'queued',
    lineUserId: 'U_phase250_auth',
    regionKey: 'ny::new-york',
    traceId: 'trace_phase250_auth_seed',
    draftSourceCandidates: ['https://example.com/source-auth-001']
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
    if (prevAdminToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevAdminToken;
    if (prevJobToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevJobToken;
  });

  const adminRoutes = [
    '/api/admin/review-inbox?limit=5',
    '/api/admin/city-pack-metrics?windowDays=7&limit=10',
    '/api/admin/city-pack-feedback?limit=5',
    '/api/admin/city-pack-bulletins?limit=5',
    '/api/admin/city-pack-source-audit/runs?limit=5',
    '/api/admin/vendors/shadow-relevance?lineUserId=U_phase250_auth&limit=5'
  ];
  for (const path of adminRoutes) {
    const unauthorized = await request({ port, method: 'GET', path });
    assert.strictEqual(unauthorized.status, 401, `expected 401 for ${path}`);
    const authorized = await request({
      port,
      method: 'GET',
      path,
      headers: {
        'x-admin-token': 'phase250_admin_token',
        'x-actor': 'phase250_auth_test',
        'x-trace-id': `trace_phase250_auth_admin_${encodeURIComponent(path)}`
      }
    });
    assert.notStrictEqual(authorized.status, 401, `expected non-401 for ${path}`);
  }

  const internalRoutes = [
    '/internal/jobs/city-pack-source-audit',
    '/internal/jobs/city-pack-audit-light',
    '/internal/jobs/city-pack-audit-heavy',
    '/internal/jobs/city-pack-draft-generator',
    '/internal/jobs/emergency-sync',
    '/internal/jobs/emergency-provider-fetch',
    '/internal/jobs/emergency-provider-normalize',
    '/internal/jobs/emergency-provider-summarize',
    '/internal/jobs/municipality-schools-import',
    '/internal/jobs/school-calendar-audit',
    '/internal/jobs/struct-drift-backfill',
    '/internal/jobs/retention-dry-run',
    '/internal/jobs/retention-apply',
    '/internal/jobs/ops-snapshot-build',
    '/internal/jobs/journey-todo-reminder',
    '/internal/jobs/task-nudge',
    '/internal/jobs/journey-branch-dispatch',
    '/internal/jobs/user-context-snapshot-build',
    '/internal/jobs/user-context-snapshot-recompress',
    '/internal/jobs/journey-kpi-build',
    '/internal/jobs/llm-action-reward-finalize'
  ];

  for (const path of internalRoutes) {
    const unauthorized = await request({
      port,
      method: 'POST',
      path,
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    assert.ok(
      unauthorized.status === 401 || unauthorized.status === 503,
      `expected internal auth/config rejection without token for ${path}, got ${unauthorized.status}`
    );

    const adminTokenOnly = await request({
      port,
      method: 'POST',
      path,
      headers: {
        'content-type': 'application/json',
        'x-admin-token': 'phase250_admin_token'
      },
      body: JSON.stringify({})
    });
    assert.ok(
      adminTokenOnly.status === 401 || adminTokenOnly.status === 503,
      `expected internal auth/config rejection with admin token only for ${path}, got ${adminTokenOnly.status}`
    );

    const internalToken = await request({
      port,
      method: 'POST',
      path,
      headers: {
        'content-type': 'application/json',
        'x-city-pack-job-token': 'phase250_job_token',
        'x-trace-id': `trace_phase250_auth_internal_${encodeURIComponent(path)}`
      },
      body: JSON.stringify({
        requestId: 'cpr_phase250_auth_001',
        runId: 'run_phase250_auth_001',
        sourceUrls: ['https://example.com/source-auth-001'],
        targetSourceRefIds: []
      })
    });
    assert.notStrictEqual(internalToken.status, 401, `expected non-401 for internal token ${path}`);
  }
});
