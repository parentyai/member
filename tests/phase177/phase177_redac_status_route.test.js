'use strict';

const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  getDb,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const auditLogsRepo = require('../../src/repos/firestore/auditLogsRepo');

function httpRequest({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

test('phase177: redac status route returns sampled consistency summary', async (t) => {
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.ADMIN_OS_TOKEN = 'test_admin_token';
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test_redac_hmac_secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  const db = getDb();
  await db.collection('users').doc('U1').set({
    createdAt: '2026-02-12T00:00:00.000Z',
    redacMembershipIdHash: 'HASH_1',
    redacMembershipIdLast4: '0001'
  });
  await db.collection('users').doc('U2').set({
    createdAt: '2026-02-12T00:00:01.000Z',
    redacMembershipIdHash: 'HASH_2',
    redacMembershipIdLast4: '0002'
  });
  await db.collection('users').doc('U3').set({
    createdAt: '2026-02-12T00:00:02.000Z',
    redacMembershipIdHash: null,
    redacMembershipIdLast4: '0003'
  });

  await db.collection('redac_membership_links').doc('HASH_1').set({
    lineUserId: 'U1',
    redacMembershipIdHash: 'HASH_1'
  });
  await db.collection('redac_membership_links').doc('HASH_X').set({
    lineUserId: 'UX',
    redacMembershipIdHash: 'HASH_X'
  });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
    else process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  });

  const res = await httpRequest({
    port,
    method: 'GET',
    path: '/api/admin/os/redac/status?limit=50',
    headers: {
      'x-admin-token': 'test_admin_token',
      'x-actor': 'admin_master',
      'x-trace-id': 'TRACE_REDAC_STATUS'
    }
  });
  assert.strictEqual(res.status, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.secretConfigured, true);
  assert.strictEqual(body.sampleLimit, 50);
  assert.strictEqual(body.summary.status, 'WARN');
  assert.strictEqual(body.summary.usersSampled, 3);
  assert.strictEqual(body.summary.linksSampled, 2);
  assert.strictEqual(body.summary.usersWithHash, 2);
  assert.strictEqual(body.summary.usersWithLast4Only, 1);
  assert.strictEqual(body.summary.orphanLinksSampled, 1);
  assert.strictEqual(body.summary.missingLinksSampled, 1);
  assert.ok(Array.isArray(body.summary.issues) && body.summary.issues.length > 0);

  const audits = await auditLogsRepo.listAuditLogsByTraceId('TRACE_REDAC_STATUS', 20);
  assert.ok(audits.some((item) => item.action === 'redac_membership.status.view'));
});

test('phase177: master ui includes redac health section and status endpoint call', () => {
  const file = path.resolve('apps/admin/master.html');
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /Redac Health（運用確認）/);
  assert.match(text, /id="redac-health-reload"/);
  assert.match(text, /\/api\/admin\/os\/redac\/status\?limit=500/);
  assert.match(text, /loadRedacStatus\(\)/);
});
