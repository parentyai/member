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

const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');
const decisionLogsRepo = require('../../src/repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../src/repos/firestore/decisionTimelineRepo');

function httpRequest({ port, method, path }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', reject);
    req.end();
  });
}

test('phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevMode === undefined) delete process.env.SERVICE_MODE;
    else process.env.SERVICE_MODE = prevMode;
  });

  await auditLogsRepo.appendAuditLog({
    actor: 'ops_readonly',
    action: 'ops_console.view',
    entityType: 'user',
    entityId: 'U1',
    traceId: 'TRACE1',
    requestId: 'REQ1',
    payloadSummary: { lineUserId: 'U1' }
  });

  await decisionLogsRepo.appendDecision({
    subjectType: 'user',
    subjectId: 'U1',
    decision: 'OK',
    nextAction: 'NO_ACTION',
    decidedBy: 'ops',
    reason: 'test',
    traceId: 'TRACE1',
    requestId: 'REQ1',
    audit: { traceId: 'TRACE1', requestId: 'REQ1' }
  });

  await decisionTimelineRepo.appendTimelineEntry({
    lineUserId: 'U1',
    source: 'ops',
    action: 'DECIDE',
    refId: 'd1',
    notificationId: null,
    traceId: 'TRACE1',
    requestId: 'REQ1',
    actor: 'ops_readonly',
    snapshot: { ok: true }
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/trace?traceId=TRACE1&limit=50'
  });

  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.traceId, 'TRACE1');
  assert.ok(Array.isArray(body.audits));
  assert.ok(Array.isArray(body.decisions));
  assert.ok(Array.isArray(body.timeline));
  assert.strictEqual(body.audits.length, 1);
  assert.strictEqual(body.decisions.length, 1);
  assert.strictEqual(body.timeline.length, 1);
  assert.strictEqual(body.audits[0].traceId, 'TRACE1');
  assert.strictEqual(body.decisions[0].traceId, 'TRACE1');
  assert.strictEqual(body.timeline[0].traceId, 'TRACE1');
});

