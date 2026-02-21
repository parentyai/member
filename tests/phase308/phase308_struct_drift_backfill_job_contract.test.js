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

test('phase308: struct drift backfill supports dry-run and apply with audit trace', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevInternalToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  if (prevAdminToken !== undefined) delete process.env.ADMIN_OS_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase308_struct_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('users').doc('U1').set({ scenario: 'A', createdAt: '2026-01-01T00:00:00.000Z' }, { merge: false });
  await db.collection('users').doc('U2').set({ scenarioKey: 'B', createdAt: '2026-01-01T00:00:00.000Z' }, { merge: false });
  await db.collection('ops_state').doc('global').set({
    lastReviewedAt: '2026-02-01T00:00:00Z',
    lastReviewedBy: 'legacy_ops'
  }, { merge: false });

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
    if (prevInternalToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternalToken;
  });

  const dryRunRes = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/struct-drift-backfill',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase308_struct_token',
      'x-trace-id': 'trace_phase308_dryrun'
    },
    body: JSON.stringify({ dryRun: true, scanLimit: 100 })
  });
  assert.strictEqual(dryRunRes.status, 200);
  const dryRunPayload = JSON.parse(dryRunRes.body);
  assert.strictEqual(dryRunPayload.ok, true);
  assert.strictEqual(dryRunPayload.summary.dryRun, true);
  assert.strictEqual(dryRunPayload.summary.scenarioDriftCandidates, 1);
  assert.strictEqual(dryRunPayload.summary.opsStateDriftCandidate, true);

  const userAfterDryRun = await db.collection('users').doc('U1').get();
  assert.strictEqual(userAfterDryRun.data().scenarioKey, undefined);
  const opsCanonicalAfterDryRun = await db.collection('ops_states').doc('global').get();
  assert.strictEqual(opsCanonicalAfterDryRun.exists, false);

  const applyRes = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/struct-drift-backfill',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase308_struct_token',
      'x-trace-id': 'trace_phase308_apply'
    },
    body: JSON.stringify({ apply: true, scanLimit: 100 })
  });
  assert.strictEqual(applyRes.status, 200);
  const applyPayload = JSON.parse(applyRes.body);
  assert.strictEqual(applyPayload.ok, true);
  assert.strictEqual(applyPayload.summary.dryRun, false);
  assert.strictEqual(applyPayload.summary.scenarioBackfilled, 1);
  assert.strictEqual(applyPayload.summary.opsStateBackfilled, true);

  const userAfterApply = await db.collection('users').doc('U1').get();
  assert.strictEqual(userAfterApply.data().scenarioKey, 'A');
  const opsCanonicalAfterApply = await db.collection('ops_states').doc('global').get();
  assert.strictEqual(opsCanonicalAfterApply.exists, true);
  assert.strictEqual(opsCanonicalAfterApply.data().lastReviewedBy, 'legacy_ops');

  const auditSnap = await db.collection('audit_logs').get();
  const traces = auditSnap.docs.map((doc) => (doc.data() || {}).traceId).filter(Boolean);
  assert.ok(traces.includes('trace_phase308_dryrun'));
  assert.ok(traces.includes('trace_phase308_apply'));
});
