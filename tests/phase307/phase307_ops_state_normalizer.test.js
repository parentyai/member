'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { normalizeOpsStateRecord } = require('../../src/domain/normalizers/opsStateNormalizer');
const opsStateRepo = require('../../src/repos/firestore/opsStateRepo');

test('phase307: normalizeOpsStateRecord keeps canonical keys only', () => {
  const normalized = normalizeOpsStateRecord({
    lastReviewedAt: '2026-02-01T00:00:00Z',
    lastReviewedBy: 'ops_user',
    extra: 'ignore'
  });
  assert.deepStrictEqual(normalized, {
    lastReviewedAt: '2026-02-01T00:00:00Z',
    lastReviewedBy: 'ops_user'
  });
});

test('phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('ops_state').doc('global').set({
    lastReviewedAt: '2026-01-01T00:00:00Z',
    lastReviewedBy: 'legacy_user'
  }, { merge: false });

  const legacyRead = await opsStateRepo.getOpsState();
  assert.strictEqual(legacyRead.collection, 'ops_state');
  assert.strictEqual(legacyRead.lastReviewedBy, 'legacy_user');

  await db.collection('ops_states').doc('global').set({
    lastReviewedAt: '2026-02-01T00:00:00Z',
    lastReviewedBy: 'canonical_user'
  }, { merge: false });

  const canonicalRead = await opsStateRepo.getOpsState();
  assert.strictEqual(canonicalRead.collection, 'ops_states');
  assert.strictEqual(canonicalRead.lastReviewedBy, 'canonical_user');

  await opsStateRepo.setOpsReview({ reviewedBy: 'bridge_writer' });
  const written = await db.collection('ops_states').doc('global').get();
  assert.strictEqual(written.exists, true);
  assert.strictEqual(written.data().lastReviewedBy, 'bridge_writer');
});
