'use strict';

const assert = require('assert');
const http = require('http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const { setDbForTest, clearDbForTest, setServerTimestampForTest, clearServerTimestampForTest } = require('../../src/infra/firestore');

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

test('phase307: retention dry-run does not delete docs and appends audit log', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevAdminToken = process.env.ADMIN_OS_TOKEN;
  const prevInternalToken = process.env.CITY_PACK_JOB_TOKEN;
  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  if (prevAdminToken !== undefined) delete process.env.ADMIN_OS_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase307_retention_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  await db.collection('events').doc('evt_1').set({ type: 'OPEN' }, { merge: false });
  await db.collection('events').doc('evt_2').set({ type: 'CLICK' }, { merge: false });
  await db.collection('users').doc('U1').set({ name: 'u1' }, { merge: false });

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

  const res = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/retention-dry-run',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase307_retention_token',
      'x-trace-id': 'trace_phase307_retention'
    },
    body: JSON.stringify({
      collections: ['events', 'users'],
      sampleLimit: 1
    })
  });

  assert.strictEqual(res.status, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.dryRun, true);
  assert.strictEqual(payload.summary.deleteCandidates, 0);
  assert.strictEqual(payload.items.length, 2);
  assert.strictEqual(payload.items[0].sampleLimit, 1);

  const eventsSnap = await db.collection('events').get();
  const usersSnap = await db.collection('users').get();
  assert.strictEqual(eventsSnap.docs.length, 2);
  assert.strictEqual(usersSnap.docs.length, 1);

  const auditSnap = await db.collection('audit_logs').get();
  const actions = auditSnap.docs.map((doc) => doc.data().action);
  assert.ok(actions.includes('retention.dry_run.execute'));
});
