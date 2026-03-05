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
const cityPackFeedbackRepo = require('../../src/repos/firestore/cityPackFeedbackRepo');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

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

test('phase250: feedback admin actions update state and emit traceable audit logs', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.ADMIN_OS_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.ADMIN_OS_TOKEN = 'phase250_admin_token';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await cityPackFeedbackRepo.createFeedback({
    id: 'cpf_phase250_001',
    status: 'queued',
    lineUserId: 'U_phase250_feedback_001',
    regionKey: 'ny::new-york',
    packClass: 'regional',
    language: 'ja',
    feedbackText: 'wrong link',
    traceId: 'trace_phase250_feedback_seed'
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

  const triageRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-feedback/cpf_phase250_001/triage',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_feedback_test',
      'x-trace-id': 'trace_phase250_feedback_triage'
    },
    body: JSON.stringify({})
  });
  assert.strictEqual(triageRes.status, 200);
  const triaged = await cityPackFeedbackRepo.getFeedback('cpf_phase250_001');
  assert.strictEqual(triaged.status, 'triaged');

  const resolveRes = await request({
    port,
    method: 'POST',
    path: '/api/admin/city-pack-feedback/cpf_phase250_001/resolve',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase250_admin_token',
      'x-actor': 'phase250_feedback_test',
      'x-trace-id': 'trace_phase250_feedback_resolve'
    },
    body: JSON.stringify({ resolution: 'fixed' })
  });
  assert.strictEqual(resolveRes.status, 200);
  const resolved = await cityPackFeedbackRepo.getFeedback('cpf_phase250_001');
  assert.strictEqual(resolved.status, 'resolved');
  assert.strictEqual(resolved.resolution, 'fixed');
  assert.ok(typeof resolved.resolvedAt === 'string' && resolved.resolvedAt.length > 0);

  const triageAudits = await auditLogsRepo.listAuditLogsByTraceId('trace_phase250_feedback_triage', 20);
  assert.ok(triageAudits.some((row) => row.action === 'city_pack.feedback.triage'));
  const resolveAudits = await auditLogsRepo.listAuditLogsByTraceId('trace_phase250_feedback_resolve', 20);
  assert.ok(resolveAudits.some((row) => row.action === 'city_pack.feedback.resolve'));
});
