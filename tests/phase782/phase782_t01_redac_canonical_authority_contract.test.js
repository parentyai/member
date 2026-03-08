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
const { declareRedacMembershipIdFromLine } = require('../../src/usecases/users/declareRedacMembershipIdFromLine');
const { normalizeRedacMembershipId, computeRedacMembershipIdHash } = require('../../src/domain/redacMembershipId');
const {
  REDAC_CANONICAL_LINK_COLLECTION,
  REDAC_LEGACY_LINK_COLLECTION
} = require('../../src/domain/canonicalAuthority');

let prevSecret;
let prevEnvName;

beforeEach(() => {
  prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  prevEnvName = process.env.ENV_NAME;
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test-redac-membership-hmac-secret';
  process.env.ENV_NAME = 'test';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (typeof prevSecret === 'string') process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  else delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  if (typeof prevEnvName === 'string') process.env.ENV_NAME = prevEnvName;
  else delete process.env.ENV_NAME;
});

test('phase782: declare detects duplicate from legacy ridac collection (legacy read compatibility)', async () => {
  const db = getDb();
  const normalized = normalizeRedacMembershipId('00-0000');
  const hash = computeRedacMembershipIdHash(normalized, process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET);

  await db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash).set({
    lineUserId: 'U_OTHER',
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: '0000',
    linkedAt: '2026-03-01T00:00:00.000Z'
  }, { merge: false });

  const result = await declareRedacMembershipIdFromLine({
    lineUserId: 'U_SELF',
    text: '会員ID 00-0000',
    requestId: 'req_phase782_duplicate'
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.status, 'duplicate');
  assert.strictEqual(result.legacyReadUsed, true);
  assert.strictEqual(result.duplicateCollection, REDAC_LEGACY_LINK_COLLECTION);

  const canonicalSnap = await db.collection(REDAC_CANONICAL_LINK_COLLECTION).doc(hash).get();
  assert.strictEqual(canonicalSnap.exists, false);
});

test('phase782: declare writes canonical redac collection only (no new ridac write)', async () => {
  const db = getDb();
  const result = await declareRedacMembershipIdFromLine({
    lineUserId: 'U_CANON',
    text: '会員ID 11-1111',
    requestId: 'req_phase782_canonical_write'
  });

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.status, 'linked');
  assert.strictEqual(result.legacyReadUsed, false);

  const normalized = normalizeRedacMembershipId('11-1111');
  const hash = computeRedacMembershipIdHash(normalized, process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET);
  const canonicalSnap = await db.collection(REDAC_CANONICAL_LINK_COLLECTION).doc(hash).get();
  const legacySnap = await db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash).get();

  assert.strictEqual(canonicalSnap.exists, true);
  assert.strictEqual(legacySnap.exists, false);
  assert.strictEqual(canonicalSnap.data().redacMembershipIdHash, hash);
  assert.strictEqual(canonicalSnap.data().lineUserId, 'U_CANON');
});
