'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const faqArticlesRepo = require('../../src/repos/firestore/faqArticlesRepo');

function iso(value) {
  return new Date(value).toISOString();
}

test('phase793: faqArticlesRepo dual-writes canonical core outbox on create/update/delete', async (t) => {
  const previousDualWrite = process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
  process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = 'true';
  t.after(() => {
    if (previousDualWrite === undefined) delete process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1;
    else process.env.ENABLE_CANONICAL_CORE_OUTBOX_DUAL_WRITE_V1 = previousDualWrite;
  });

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const created = await faqArticlesRepo.createArticle({
    title: 'SSN手続き',
    body: 'SSN手続きの説明',
    keywords: ['ssn'],
    synonyms: [],
    tags: [],
    status: 'draft',
    locale: 'ja',
    riskLevel: 'high',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-12-01T00:00:00Z')
  });
  await faqArticlesRepo.updateArticle(created.id, { status: 'active' });
  await faqArticlesRepo.deleteArticle(created.id);

  const outbox = db._state.collections.canonical_core_outbox;
  assert.ok(outbox, 'canonical_core_outbox collection must exist');
  const rows = Object.values(outbox.docs).map((doc) => doc.data).filter((row) => row.objectId === created.id);
  assert.ok(rows.length >= 2, 'faq article dual-write must emit upsert/delete events');
  const upsert = rows.find((row) => row.eventType === 'upsert');
  const deleted = rows.find((row) => row.eventType === 'delete');
  assert.ok(upsert, 'upsert event is required');
  assert.ok(deleted, 'delete event is required');
  assert.equal(upsert.objectType, 'knowledge_object');
  assert.equal(deleted.objectType, 'knowledge_object');
  assert.equal(deleted.payloadSummary.status, 'disabled');
});
