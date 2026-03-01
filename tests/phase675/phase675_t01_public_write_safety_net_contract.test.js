'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const http = require('node:http');
const Module = require('node:module');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { createTrackToken } = require('../../src/domain/trackToken');
const { handleLineWebhook } = require('../../src/routes/webhookLine');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

function httpRequest({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers: headers || {}
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function signStripe(secret, timestamp, body) {
  return crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex');
}

function signLine(secret, body) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64');
}

function listAuditRows(db) {
  const logs = db._state.collections.audit_logs;
  if (!logs || !logs.docs) return [];
  return Object.values(logs.docs).map((entry) => entry && entry.data).filter(Boolean);
}

function createSystemFlagsReadFailDb(baseDb) {
  return Object.assign({}, baseDb, {
    collection(name) {
      const col = baseDb.collection(name);
      if (name !== 'system_flags') return col;
      return Object.assign({}, col, {
        doc(id) {
          const docRef = col.doc(id);
          if (id !== 'phase0') return docRef;
          return Object.assign({}, docRef, {
            async get() {
              throw new Error('phase675_system_flag_read_failed');
            }
          });
        }
      });
    }
  });
}

function stubFirebaseAdminIncrement() {
  const originalLoad = Module._load;
  Module._load = function load(request, parent, isMain) {
    if (request === 'firebase-admin') {
      return {
        firestore: {
          FieldValue: {
            increment: (value) => ({ __increment: value })
          }
        }
      };
    }
    return originalLoad(request, parent, isMain);
  };
  return () => {
    Module._load = originalLoad;
  };
}

async function startServer() {
  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return {
    server,
    port: server.address().port
  };
}

test('phase675: phase1Events blocks writes on kill switch and records trace/audit', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: null,
    ADMIN_OS_TOKEN: 'phase675_admin'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true });

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const response = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/api/phase1/events',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase675_admin'
    },
    body: JSON.stringify({
      lineUserId: 'U_PHASE675_EVENT',
      type: 'click',
      ref: { notificationId: 'N_PHASE675_EVENT' }
    })
  });

  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error, 'kill switch on');
  assert.ok(!db._state.collections.events, 'events write should be blocked by kill switch');

  const blockedAudit = listAuditRows(db).find((row) => row.action === 'phase1.events.blocked');
  assert.ok(blockedAudit, 'phase1.events.blocked audit should exist');
  assert.equal(blockedAudit.payloadSummary.errorCode, 'kill_switch_on');
  assert.ok(typeof blockedAudit.traceId === 'string' && blockedAudit.traceId.length > 0);
});

test('phase675: track click GET/POST block on kill switch and keep trace in audit', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: 'track',
    TRACK_TOKEN_SECRET: 'phase675_track_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true });

  const restoreAdminStub = stubFirebaseAdminIncrement();

  await db.collection('link_registry').doc('l1').set({ url: 'https://example.com', createdAt: 1 });
  await db.collection('notifications').doc('n1').set({
    title: 'title',
    body: 'body',
    ctaText: 'openA',
    linkRegistryId: 'l1',
    createdAt: 1
  });
  const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U_PHASE675_TRACK',
    delivered: true
  });

  const token = createTrackToken({
    deliveryId: delivery.id,
    linkRegistryId: 'l1'
  }, { secret: process.env.TRACK_TOKEN_SECRET });

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    restoreAdminStub();
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const getRes = await httpRequest({
    port: boot.port,
    method: 'GET',
    path: `/t/${encodeURIComponent(token)}`
  });
  assert.equal(getRes.status, 403);

  const postRes = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/track/click',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryId: delivery.id, linkRegistryId: 'l1' })
  });
  assert.equal(postRes.status, 403);

  const deliveryDoc = db._state.collections.notification_deliveries.docs[delivery.id];
  assert.ok(deliveryDoc);
  assert.equal(deliveryDoc.data.clickAt, undefined, 'click write should be blocked');

  const audits = listAuditRows(db).filter((row) => row.action === 'track.click.get' || row.action === 'track.click.post');
  assert.equal(audits.length, 2);
  audits.forEach((row) => {
    assert.equal(row.payloadSummary.errorCode, 'kill_switch_on');
    assert.ok(typeof row.traceId === 'string' && row.traceId.length > 0);
  });
});

test('phase675: stripe webhook blocks on kill switch with blocked audit and trace', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: 'webhook',
    ENABLE_STRIPE_WEBHOOK: '1',
    STRIPE_WEBHOOK_SECRET: 'whsec_phase675'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true });

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const eventBody = JSON.stringify({
    id: 'evt_phase675_kill_switch',
    type: 'customer.subscription.updated',
    created: 1710003000,
    data: {
      object: {
        id: 'sub_phase675',
        customer: 'cus_phase675',
        status: 'active',
        current_period_end: 1711003000,
        metadata: { lineUserId: 'U_PHASE675_STRIPE' }
      }
    }
  });
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = signStripe(process.env.STRIPE_WEBHOOK_SECRET, timestamp, eventBody);

  const response = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/webhook/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': `t=${timestamp},v1=${signature}`
    },
    body: eventBody
  });

  assert.equal(response.status, 409);
  assert.equal(response.body, 'kill switch on');
  assert.ok(!db._state.collections.stripe_webhook_events, 'stripe event write should be blocked');

  const blockedAudit = listAuditRows(db).find((row) => row.action === 'stripe_webhook.blocked');
  assert.ok(blockedAudit, 'stripe_webhook.blocked audit should exist');
  assert.equal(blockedAudit.payloadSummary.reason, 'kill_switch_on');
  assert.ok(typeof blockedAudit.traceId === 'string' && blockedAudit.traceId.length > 0);
});

test('phase675: webhookLine blocks on kill switch and emits blocked audit with trace', async () => {
  const restoreEnv = withEnv({
    LINE_CHANNEL_SECRET: 'phase675_line_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true });

  try {
    const payload = {
      events: [
        {
          type: 'message',
          replyToken: 'rt_phase675',
          source: { userId: 'U_PHASE675_LINE' },
          message: { type: 'text', text: 'こんにちは' }
        }
      ]
    };
    const body = JSON.stringify(payload);
    const signature = signLine(process.env.LINE_CHANNEL_SECRET, body);

    const result = await handleLineWebhook({
      signature,
      body,
      logger: () => {}
    });

    assert.equal(result.status, 409);
    assert.equal(result.body, 'kill switch on');
    assert.ok(!db._state.collections.users, 'user write should be blocked');

    const blockedAudit = listAuditRows(db).find((row) => row.action === 'line_webhook.blocked');
    assert.ok(blockedAudit, 'line_webhook.blocked audit should exist');
    assert.equal(blockedAudit.payloadSummary.reason, 'kill_switch_on');
    assert.ok(typeof blockedAudit.traceId === 'string' && blockedAudit.traceId.length > 0);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  }
});

test('phase675: legacy phase1 notifications create/send block on kill switch and append audit', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: null,
    ADMIN_OS_TOKEN: 'phase675_admin'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true });

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const createRes = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/admin/phase1/notifications',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase675_admin'
    },
    body: JSON.stringify({})
  });
  assert.equal(createRes.status, 403);
  assert.equal(createRes.body, 'kill switch on');

  const sendRes = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/admin/phase1/notifications/phase675_n1/send',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase675_admin'
    },
    body: JSON.stringify({})
  });
  assert.equal(sendRes.status, 403);
  assert.equal(sendRes.body, 'kill switch on');

  const audits = listAuditRows(db);
  const createBlocked = audits.find((row) => row.action === 'phase1.notifications.create.blocked');
  const sendBlocked = audits.find((row) => row.action === 'phase1.notifications.send.blocked');
  assert.ok(createBlocked);
  assert.ok(sendBlocked);
  assert.ok(typeof createBlocked.traceId === 'string' && createBlocked.traceId.length > 0);
  assert.ok(typeof sendBlocked.traceId === 'string' && sendBlocked.traceId.length > 0);
});

test('phase675: WARN mode allows phase1Events when killSwitch read fails and appends guard_warn audit', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: null,
    ADMIN_OS_TOKEN: 'phase675_admin',
    PUBLIC_WRITE_FAIL_CLOSE_MODE: 'warn'
  });
  const db = createDbStub();
  const failDb = createSystemFlagsReadFailDb(db);
  setDbForTest(failDb);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const response = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/api/phase1/events',
    headers: {
      'content-type': 'application/json',
      'x-admin-token': 'phase675_admin'
    },
    body: JSON.stringify({
      lineUserId: 'U_PHASE675_WARN_EVENT',
      type: 'click',
      ref: { notificationId: 'N_PHASE675_WARN_EVENT' }
    })
  });

  assert.equal(response.status, 200);
  const parsed = JSON.parse(response.body);
  assert.equal(parsed.ok, true);
  assert.ok(typeof parsed.id === 'string' && parsed.id.length > 0);

  const guardWarn = listAuditRows(db).find((row) => row.action === 'phase1.events.guard_warn');
  assert.ok(guardWarn);
  assert.equal(guardWarn.payloadSummary.errorCode, 'kill_switch_read_failed_fail_open');
  assert.equal(guardWarn.payloadSummary.failCloseMode, 'warn');
});

test('phase675: ENFORCE mode fail-closes track click when killSwitch read fails', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: 'track',
    TRACK_TOKEN_SECRET: 'phase675_track_secret',
    PUBLIC_WRITE_FAIL_CLOSE_MODE: 'enforce'
  });
  const db = createDbStub();
  const failDb = createSystemFlagsReadFailDb(db);
  setDbForTest(failDb);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  const restoreAdminStub = stubFirebaseAdminIncrement();

  await db.collection('link_registry').doc('l1').set({ url: 'https://example.com', createdAt: 1 });
  await db.collection('notifications').doc('n1').set({
    title: 'title',
    body: 'body',
    ctaText: 'openA',
    linkRegistryId: 'l1',
    createdAt: 1
  });
  const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U_PHASE675_ENFORCE_TRACK',
    delivered: true
  });

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    restoreAdminStub();
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const postRes = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/track/click',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryId: delivery.id, linkRegistryId: 'l1' })
  });
  assert.equal(postRes.status, 503);
  assert.equal(postRes.body, 'temporarily unavailable');
  const deliveryDoc = db._state.collections.notification_deliveries.docs[delivery.id];
  assert.ok(deliveryDoc);
  assert.equal(deliveryDoc.data.clickAt, undefined);

  const blocked = listAuditRows(db).find((row) => {
    return row.action === 'track.click.post'
      && row.payloadSummary
      && row.payloadSummary.errorCode === 'kill_switch_read_failed_fail_closed';
  });
  assert.ok(blocked);
  assert.equal(blocked.payloadSummary.failCloseMode, 'enforce');
});

test('phase675: track audit enqueue failure emits observable detection log', async (t) => {
  const restoreEnv = withEnv({
    SERVICE_MODE: 'track',
    TRACK_TOKEN_SECRET: 'phase675_track_secret'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({
    killSwitch: false,
    trackAuditWriteMode: 'await'
  }, { merge: true });
  const restoreAdminStub = stubFirebaseAdminIncrement();

  await db.collection('link_registry').doc('l1').set({ url: 'https://example.com', createdAt: 1 });
  await db.collection('notifications').doc('n1').set({
    title: 'title',
    body: 'body',
    ctaText: 'openA',
    linkRegistryId: 'l1',
    createdAt: 1
  });
  const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
  const delivery = await deliveriesRepo.createDelivery({
    notificationId: 'n1',
    lineUserId: 'U_PHASE675_AUDIT_MON',
    delivered: true
  });

  const auditLogUsecase = require('../../src/usecases/audit/appendAuditLog');
  const prevAppendAuditLog = auditLogUsecase.appendAuditLog;
  auditLogUsecase.appendAuditLog = async () => {
    throw new Error('phase675_track_audit_enqueue_failed');
  };
  const warnLines = [];
  const prevWarn = console.warn;
  console.warn = (...args) => {
    warnLines.push(args.join(' '));
  };

  const boot = await startServer();
  t.after(async () => {
    await new Promise((resolve) => boot.server.close(resolve));
    console.warn = prevWarn;
    auditLogUsecase.appendAuditLog = prevAppendAuditLog;
    restoreAdminStub();
    clearDbForTest();
    clearServerTimestampForTest();
    restoreEnv();
  });

  const postRes = await httpRequest({
    port: boot.port,
    method: 'POST',
    path: '/track/click',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ deliveryId: delivery.id, linkRegistryId: 'l1' })
  });
  assert.equal(postRes.status, 302);
  assert.equal(postRes.headers.location, 'https://example.com');

  const detection = warnLines.find((line) => {
    return line.includes('action=track_audit_enqueue')
      && line.includes('result=error')
      && line.includes('route=track_click_post');
  });
  assert.ok(detection, 'track audit enqueue failure detection log should be emitted');
});
