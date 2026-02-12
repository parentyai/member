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
const { ensureUserFromWebhook } = require('../../src/usecases/users/ensureUser');
const { declareRidacMembershipIdFromLine } = require('../../src/usecases/users/declareRidacMembershipIdFromLine');
const ridacLinksRepo = require('../../src/repos/firestore/ridacMembershipLinksRepo');

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

test('ridac membership: happy path links and persists hash+last4', async () => {
  await ensureUserFromWebhook('U1');
  const out = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID 00-0000', requestId: 'req1' });
  assert.deepStrictEqual(out, { ok: true, status: 'linked', last4: '0000' });

  const user = await usersRepo.getUser('U1');
  assert.strictEqual(user.ridacMembershipIdLast4, '0000');
  assert.strictEqual(user.ridacMembershipDeclaredBy, 'user');
  assert.strictEqual(user.ridacMembershipDeclaredAt, 'SERVER_TIMESTAMP');
  assert.ok(typeof user.ridacMembershipIdHash === 'string' && user.ridacMembershipIdHash.length > 10);

  const link = await ridacLinksRepo.getLinkByHash(user.ridacMembershipIdHash);
  assert.ok(link);
  assert.strictEqual(link.lineUserId, 'U1');
  assert.strictEqual(link.ridacMembershipIdLast4, '0000');
});

test('ridac membership: duplicate (linked to another user) is rejected', async () => {
  await ensureUserFromWebhook('U1');
  await ensureUserFromWebhook('U2');

  const r1 = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID 12-3456', requestId: 'req1' });
  assert.strictEqual(r1.ok, true);

  const r2 = await declareRidacMembershipIdFromLine({ lineUserId: 'U2', text: '会員ID 12-3456', requestId: 'req2' });
  assert.strictEqual(r2.ok, false);
  assert.strictEqual(r2.status, 'duplicate');

  const u2 = await usersRepo.getUser('U2');
  assert.strictEqual(u2.ridacMembershipIdHash || null, null);
  assert.strictEqual(u2.ridacMembershipIdLast4 || null, null);
});

test('ridac membership: invalid format returns invalid_format', async () => {
  await ensureUserFromWebhook('U1');
  const out = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID 1-0000', requestId: 'req1' });
  assert.deepStrictEqual(out, { ok: false, status: 'invalid_format' });
});

test('ridac membership: non-command message is noop', async () => {
  await ensureUserFromWebhook('U1');
  const out = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: 'hello', requestId: 'req1' });
  assert.deepStrictEqual(out, { ok: true, status: 'noop' });
});

test('ridac membership: usage guidance when command prefix has no payload', async () => {
  await ensureUserFromWebhook('U1');
  const out = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID', requestId: 'req1' });
  assert.deepStrictEqual(out, { ok: false, status: 'usage' });
});

test('ridac membership: usage guidance when help keyword is used', async () => {
  await ensureUserFromWebhook('U1');
  const out = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID ヘルプ', requestId: 'req1' });
  assert.deepStrictEqual(out, { ok: false, status: 'usage' });
});

test('ridac membership: same user can replace their ridac id (releases previous id)', async () => {
  await ensureUserFromWebhook('U1');
  const r1 = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID 00-0001', requestId: 'req1' });
  assert.strictEqual(r1.ok, true);
  const u1a = await usersRepo.getUser('U1');
  const prevHash = u1a.ridacMembershipIdHash;

  const r2 = await declareRidacMembershipIdFromLine({ lineUserId: 'U1', text: '会員ID 00-0002', requestId: 'req2' });
  assert.strictEqual(r2.ok, true);
  const u1b = await usersRepo.getUser('U1');
  assert.notStrictEqual(u1b.ridacMembershipIdHash, prevHash);

  const prevLink = await ridacLinksRepo.getLinkByHash(prevHash);
  assert.strictEqual(prevLink, null);
});
