'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  getDb,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleRedacMembershipUnlink } = require('../../src/routes/admin/redacMembershipUnlink');
const { normalizeRedacMembershipId, computeRedacMembershipIdHash } = require('../../src/domain/redacMembershipId');
const {
  REDAC_LEGACY_LINK_COLLECTION
} = require('../../src/domain/canonicalAuthority');

let prevSecret;

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: '',
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

beforeEach(() => {
  prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test-redac-membership-hmac-secret';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (typeof prevSecret === 'string') process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  else delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
});

test('phase782: admin unlink resolves legacy ridac collection and clears legacy user aliases', async () => {
  const db = getDb();
  const normalized = normalizeRedacMembershipId('22-2222');
  const hash = computeRedacMembershipIdHash(normalized, process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET);

  await db.collection('users').doc('U_LINKED').set({
    createdAt: '2026-03-01T00:00:00.000Z',
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: '2222'
  }, { merge: false });
  await db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash).set({
    lineUserId: 'U_LINKED',
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: '2222',
    linkedAt: '2026-03-01T00:00:00.000Z'
  }, { merge: false });

  const req = {
    headers: {
      'x-actor': 'admin_test',
      'x-request-id': 'req_phase782_unlink_legacy'
    }
  };
  const res = createRes();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '22-2222' }));

  assert.strictEqual(res.statusCode, 200);
  const body = JSON.parse(res.body);
  assert.strictEqual(body.ok, true);
  assert.strictEqual(body.legacyReadUsed, true);
  assert.strictEqual(body.linkCollectionRead, REDAC_LEGACY_LINK_COLLECTION);

  const legacySnap = await db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash).get();
  assert.strictEqual(legacySnap.exists, false);

  const userSnap = await db.collection('users').doc('U_LINKED').get();
  const user = userSnap.data() || {};
  assert.strictEqual(user.redacMembershipIdHash, null);
  assert.strictEqual(user.redacMembershipIdLast4, null);
  assert.strictEqual(user.ridacMembershipIdHash, null);
  assert.strictEqual(user.ridacMembershipIdLast4, null);
});
