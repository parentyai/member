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
const ridacLinksRepo = require('../../src/repos/firestore/ridacMembershipLinksRepo');
const { ensureUserFromWebhook } = require('../../src/usecases/users/ensureUser');
const { declareRidacMembershipIdFromLine } = require('../../src/usecases/users/declareRidacMembershipIdFromLine');
const { handleRidacMembershipUnlink } = require('../../src/routes/admin/ridacMembershipUnlink');

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

let prevRidacSecret;

beforeEach(() => {
  prevRidacSecret = process.env.RIDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.RIDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test-ridac-membership-hmac-secret';

  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (typeof prevRidacSecret === 'string') process.env.RIDAC_MEMBERSHIP_ID_HMAC_SECRET = prevRidacSecret;
  else delete process.env.RIDAC_MEMBERSHIP_ID_HMAC_SECRET;
});

test('admin ridac unlink: happy path removes link and clears user fields', async () => {
  await ensureUserFromWebhook('U1');
  const declared = await declareRidacMembershipIdFromLine({
    lineUserId: 'U1',
    text: '会員ID 12-3456',
    requestId: 'req-declare'
  });
  assert.strictEqual(declared.ok, true);

  const before = await usersRepo.getUser('U1');
  assert.ok(before.ridacMembershipIdHash);

  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink' } };
  const res = createRes();
  await handleRidacMembershipUnlink(req, res, JSON.stringify({ ridacMembershipId: '12-3456' }));

  assert.strictEqual(res.statusCode, 200);
  const out = JSON.parse(res.body);
  assert.deepStrictEqual(out, { ok: true, lineUserId: 'U1', ridacMembershipIdLast4: '3456' });

  const after = await usersRepo.getUser('U1');
  assert.strictEqual(after.ridacMembershipIdHash || null, null);
  assert.strictEqual(after.ridacMembershipIdLast4 || null, null);
  assert.strictEqual(after.ridacMembershipUnlinkedAt, 'SERVER_TIMESTAMP');
  assert.strictEqual(after.ridacMembershipUnlinkedBy, 'ops');

  const link = await ridacLinksRepo.getLinkByHash(before.ridacMembershipIdHash);
  assert.strictEqual(link, null);
});

test('admin ridac unlink: not found returns 404', async () => {
  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink-404' } };
  const res = createRes();
  await handleRidacMembershipUnlink(req, res, JSON.stringify({ ridacMembershipId: '12-3456' }));
  assert.strictEqual(res.statusCode, 404);
  const out = JSON.parse(res.body);
  assert.deepStrictEqual(out, { ok: false, error: 'not_found' });
});

test('admin ridac unlink: invalid format returns 400', async () => {
  const req = { headers: { 'x-actor': 'test', 'x-request-id': 'req-unlink-400' } };
  const res = createRes();
  await handleRidacMembershipUnlink(req, res, JSON.stringify({ ridacMembershipId: '1-0000' }));
  assert.strictEqual(res.statusCode, 400);
});

