'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
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

test('phase654: user-context snapshot recompress route writes v2 keys and audit logs', async (t) => {
  const prevMode = process.env.SERVICE_MODE;
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  const prevFlag = process.env.ENABLE_CONTEXT_SNAPSHOT_V2;

  if (prevMode !== undefined) delete process.env.SERVICE_MODE;
  process.env.CITY_PACK_JOB_TOKEN = 'phase654_snapshot_token';
  process.env.ENABLE_CONTEXT_SNAPSHOT_V2 = '1';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const now = new Date('2026-02-25T00:00:00.000Z').toISOString();
  await db.collection('users').doc('U_PHASE654_SNAPSHOT').set({
    createdAt: now,
    updatedAt: now,
    stepKey: 'week',
    city: 'Singapore',
    region: 'SG',
    family: { spouse: true, kidsAges: [7] },
    priorities: ['safety', 'speed']
  }, { merge: true });

  await db.collection('events').doc('evt_phase654_snapshot_1').set({
    lineUserId: 'U_PHASE654_SNAPSHOT',
    type: 'next_action_shown',
    nextActions: [
      { key: 'visa_documents', due: now },
      { key: 'housing_setup', due: now }
    ],
    createdAt: now
  }, { merge: true });

  for (let i = 0; i < 6; i += 1) {
    await db.collection('journey_todo_items').doc(`U_PHASE654_SNAPSHOT__task_${i + 1}`).set({
      lineUserId: 'U_PHASE654_SNAPSHOT',
      todoKey: `task_${i + 1}`,
      title: `task_${i + 1}`,
      status: 'open',
      progressState: i === 0 ? 'in_progress' : 'not_started',
      graphStatus: i === 1 ? 'locked' : 'actionable',
      riskLevel: i <= 1 ? 'high' : 'medium',
      priority: i <= 1 ? 5 : 3,
      dueAt: new Date(Date.parse(now) + (i + 1) * 86400000).toISOString(),
      updatedAt: now,
      createdAt: now
    }, { merge: true });
  }

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
    if (prevFlag === undefined) delete process.env.ENABLE_CONTEXT_SNAPSHOT_V2;
    else process.env.ENABLE_CONTEXT_SNAPSHOT_V2 = prevFlag;
  });

  const res = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/user-context-snapshot-recompress',
    headers: {
      'content-type': 'application/json',
      'x-city-pack-job-token': 'phase654_snapshot_token',
      'x-trace-id': 'trace_phase654_snapshot_recompress'
    },
    body: JSON.stringify({
      lineUserIds: ['U_PHASE654_SNAPSHOT'],
      requestId: 'req_phase654_snapshot_recompress'
    })
  });

  assert.equal(res.status, 200, res.body);
  const payload = JSON.parse(res.body || '{}');
  assert.equal(payload.ok, true);
  assert.equal(payload.updated, 1);

  const snapshotDoc = await db.collection('user_context_snapshots').doc('U_PHASE654_SNAPSHOT').get();
  assert.equal(snapshotDoc.exists, true);
  const snapshot = snapshotDoc.data();
  assert.ok(Array.isArray(snapshot.topOpenTasks));
  assert.ok(Array.isArray(snapshot.riskFlags));
  assert.equal(typeof snapshot.shortSummary, 'string');
  assert.ok(snapshot.shortSummary.includes('openTasks='));

  assert.ok(Array.isArray(snapshot.openTasksTop5), 'legacy key openTasksTop5 should stay');
  assert.ok(Array.isArray(snapshot.riskFlagsTop3), 'legacy key riskFlagsTop3 should stay');
  assert.equal(typeof snapshot.lastSummary, 'string');

  const auditSnap = await db.collection('audit_logs').get();
  const actions = auditSnap.docs.map((doc) => doc.data().action);
  assert.ok(actions.includes('snapshot_updated'));
  assert.ok(actions.includes('snapshot_trimmed'));
  assert.ok(actions.includes('snapshot_recompressed'));
});
