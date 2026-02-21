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

test('phase314: retention apply supports maxDeletes/cursor and appends audit payload', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevInternal = process.env.CITY_PACK_JOB_TOKEN;
  const prevEnvName = process.env.ENV_NAME;
  const prevApplyFlag = process.env.RETENTION_APPLY_ENABLED;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase314_cursor_token';
  process.env.ENV_NAME = 'staging';
  process.env.RETENTION_APPLY_ENABLED = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('events').doc('e001').set({ createdAt: '2025-01-01T00:00:00.000Z' }, { merge: false });
  await db.collection('events').doc('e002').set({ createdAt: '2025-01-02T00:00:00.000Z' }, { merge: false });
  await db.collection('events').doc('e003').set({ createdAt: '2026-02-01T00:00:00.000Z' }, { merge: false });
  await db.collection('users').doc('U_keep').set({ createdAt: '2024-01-01T00:00:00.000Z' }, { merge: false });

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
    if (prevInternal === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevInternal;
    if (prevEnvName === undefined) delete process.env.ENV_NAME;
    else process.env.ENV_NAME = prevEnvName;
    if (prevApplyFlag === undefined) delete process.env.RETENTION_APPLY_ENABLED;
    else process.env.RETENTION_APPLY_ENABLED = prevApplyFlag;
  });

  await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_cursor_token',
      'x-trace-id': 'trace_phase314_cursor_dry_run'
    },
    body: JSON.stringify({ collections: ['events', 'users'], sampleLimit: 10 })
  });

  const first = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_cursor_token',
      'x-trace-id': 'trace_phase314_cursor_apply_1'
    },
    body: JSON.stringify({
      collections: ['events', 'users'],
      cutoffIso: '2026-01-10T00:00:00.000Z',
      dryRunTraceId: 'trace_phase314_cursor_dry_run',
      maxDeletes: 1
    })
  });
  assert.strictEqual(first.status, 200, first.body);
  const firstPayload = JSON.parse(first.body);
  assert.strictEqual(firstPayload.summary.deletedCount, 1);
  assert.strictEqual(firstPayload.hasMore, true);
  assert.ok(firstPayload.nextCursor && typeof firstPayload.nextCursor.events === 'string');

  const second = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-apply',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase314_cursor_token',
      'x-trace-id': 'trace_phase314_cursor_apply_2'
    },
    body: JSON.stringify({
      collections: ['events', 'users'],
      cutoffIso: '2026-01-10T00:00:00.000Z',
      dryRunTraceId: 'trace_phase314_cursor_dry_run',
      maxDeletes: 1,
      cursor: firstPayload.nextCursor
    })
  });
  assert.strictEqual(second.status, 200, second.body);
  const secondPayload = JSON.parse(second.body);
  assert.strictEqual(secondPayload.summary.deletedCount, 1);

  const eventsSnap = await db.collection('events').get();
  const usersSnap = await db.collection('users').get();
  assert.strictEqual(eventsSnap.docs.length, 1);
  assert.strictEqual(usersSnap.docs.length, 1);

  const auditSnap = await db.collection('audit_logs').get();
  const applyAudit = (auditSnap.docs || [])
    .map((doc) => doc.data())
    .find((row) => row && row.action === 'retention.apply.execute' && row.traceId === 'trace_phase314_cursor_apply_2');
  assert.ok(applyAudit);
  assert.strictEqual(applyAudit.payloadSummary.dryRunTraceId, 'trace_phase314_cursor_dry_run');
});
