'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const usersRepo = require('../../src/repos/firestore/usersRepo');
const redacLinksRepo = require('../../src/repos/firestore/redacMembershipLinksRepo');
const { ensureUserFromWebhook } = require('../../src/usecases/users/ensureUser');
const { declareRedacMembershipIdFromLine } = require('../../src/usecases/users/declareRedacMembershipIdFromLine');
const { handleRedacMembershipUnlink } = require('../../src/routes/admin/redacMembershipUnlink');

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

let prevRedacSecret;

beforeEach(() => {
  prevRedacSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test-redac-membership-hmac-secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (typeof prevRedacSecret === 'string') process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevRedacSecret;
  else delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
});

test('admin redac unlink: happy path removes link and clears user fields', async () => {
  await ensureUserFromWebhook('U1');
  const declared = await declareRedacMembershipIdFromLine({
    lineUserId: 'U1',
    text: '会員ID 12-3456',
    requestId: 'req-declare'
  });
  assert.strictEqual(declared.ok, true);

  const before = await usersRepo.getUser('U1');
  assert.ok(before.redacMembershipIdHash);

  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink' } };
  const res = createRes();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '12-3456' }));

  assert.strictEqual(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.deepStrictEqual(out, { ok: true, lineUserId: 'U1', redacMembershipIdLast4: '3456' });

  const after = await usersRepo.getUser('U1');
  assert.strictEqual(after.redacMembershipIdHash || null, null);
  assert.strictEqual(after.redacMembershipIdLast4 || null, null);
  assert.strictEqual(after.redacMembershipUnlinkedAt, 'SERVER_TIMESTAMP');
  assert.strictEqual(after.redacMembershipUnlinkedBy, 'ops');

  const link = await redacLinksRepo.getLinkByHash(before.redacMembershipIdHash);
  assert.strictEqual(link, null);
});

test('admin redac unlink: not found returns 404', async () => {
  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink-404' } };
  const res = createRes();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '12-3456' }));
  assert.strictEqual(res.statusCode, 404);
  const out = JSON.parse(res.body);
  assert.deepStrictEqual(out, { ok: false, error: 'not_found' });
});

test('admin redac unlink: invalid format returns 400', async () => {
  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink-400' } };
  const res = createRes();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '1-0000' }));
  assert.strictEqual(res.statusCode, 400);
});

