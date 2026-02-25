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

test('phase653: internal user-context snapshot job writes snapshot and audit evidence', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  const prevSnapshotFlag = process.env.ENABLE_USER_CONTEXT_SNAPSHOT;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase653_snapshot_token';
  process.env.ENABLE_USER_CONTEXT_SNAPSHOT = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const now = new Date('2026-02-24T00:00:00.000Z').toISOString();
  await db.collection('users').doc('U_SNAPSHOT').set({
    createdAt: now,
    updatedAt: now,
    stepKey: 'week',
    region: 'CA',
    city: 'San Francisco',
    priorities: ['safety', 'speed', 'cost', 'speed']
  }, { merge: true });

  await db.collection('events').doc('evt_snapshot_1').set({
    lineUserId: 'U_SNAPSHOT',
    type: 'next_action_shown',
    nextActions: [
      { key: 'insurance_check', due: now },
      { key: 'school_form', due: now },
      { key: 'housing_contract', due: now },
      { key: 'bank_opening', due: now },
      { key: 'tax_briefing', due: now },
      { key: 'driver_license', due: now }
    ],
    createdAt: now
  }, { merge: true });
  await db.collection('events').doc('evt_snapshot_2').set({
    lineUserId: 'U_SNAPSHOT',
    type: 'risk_alert',
    riskFlags: ['insurance_missing', 'school_pending', 'housing_risky', 'visa_late'],
    createdAt: now
  }, { merge: true });
  await db.collection('events').doc('evt_snapshot_3').set({
    lineUserId: 'U_SNAPSHOT',
    type: 'user_phase_changed',
    toPhase: 'arrival',
    createdAt: now
  }, { merge: true });

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
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
    if (prevSnapshotFlag === undefined) delete process.env.ENABLE_USER_CONTEXT_SNAPSHOT;
    else process.env.ENABLE_USER_CONTEXT_SNAPSHOT = prevSnapshotFlag;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/user-context-snapshot-build',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase653_snapshot_token',
      'x-trace-id': 'trace_phase653_snapshot'
    },
    body: JSON.stringify({ lineUserIds: ['U_SNAPSHOT'] })
  });

  assert.strictEqual(res.status, 200, res.body);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.updated, 1);

  const snapshotDoc = await db.collection('user_context_snapshots').doc('U_SNAPSHOT').get();
  assert.strictEqual(snapshotDoc.exists, true);
  const snapshot = snapshotDoc.data();
  assert.strictEqual(snapshot.phase, 'arrival');
  assert.ok(Array.isArray(snapshot.openTasksTop5));
  assert.strictEqual(snapshot.openTasksTop5.length, 5);
  assert.ok(Array.isArray(snapshot.riskFlagsTop3));
  assert.strictEqual(snapshot.riskFlagsTop3.length, 3);

  const auditSnap = await db.collection('audit_logs').get();
  const actions = auditSnap.docs.map((doc) => doc.data().action);
  assert.ok(actions.includes('snapshot_updated'));
  assert.ok(actions.includes('snapshot_dropped_keys'));
});
