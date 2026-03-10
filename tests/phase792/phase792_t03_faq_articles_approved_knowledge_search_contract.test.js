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

test('phase792: faq article search defaults to approved_knowledge bucket', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('faq_articles').doc('approved_default').set({
    title: 'SSNの必要書類',
    body: '必要書類の案内',
    keywords: ['ssn', '必要書類'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-12-01T00:00:00Z'),
    updatedAt: iso('2026-03-10T00:00:00Z')
  });
  await db.collection('faq_articles').doc('candidate_row').set({
    title: '候補記事',
    body: '候補段階',
    keywords: ['ssn'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-12-01T00:00:00Z'),
    knowledgeLifecycleState: 'candidate',
    knowledgeLifecycleBucket: 'candidate_knowledge',
    updatedAt: iso('2026-03-10T00:00:01Z')
  });
  await db.collection('faq_articles').doc('approved_explicit').set({
    title: 'SSN予約の確認',
    body: '予約要否',
    keywords: ['ssn', '予約'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-12-01T00:00:00Z'),
    knowledgeLifecycleState: 'approved',
    knowledgeLifecycleBucket: 'approved_knowledge',
    updatedAt: iso('2026-03-10T00:00:02Z')
  });

  const rows = await faqArticlesRepo.searchActiveArticles({
    query: 'SSN 必要書類',
    locale: 'ja',
    intent: 'FAQ',
    now: new Date('2026-03-10T03:00:00Z'),
    limit: 10
  });
  const ids = rows.map((row) => row.id);
  assert.deepEqual(ids.sort(), ['approved_default', 'approved_explicit']);
  rows.forEach((row) => {
    assert.equal(row.knowledgeLifecycleBucket, 'approved_knowledge');
    assert.equal(row.knowledgeLifecycleState, 'approved');
  });
});

test('phase792: create/update/delete article persist lifecycle fields', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const created = await faqArticlesRepo.createArticle({
    title: '学校手続き',
    body: '入学手続きの概要',
    keywords: ['学校'],
    synonyms: [],
    tags: [],
    status: 'draft',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-12-01T00:00:00Z')
  });
  const before = await faqArticlesRepo.getArticle(created.id);
  assert.equal(before.knowledgeLifecycleState, 'candidate');
  assert.equal(before.knowledgeLifecycleBucket, 'candidate_knowledge');

  await faqArticlesRepo.updateArticle(created.id, { status: 'active' });
  const approved = await faqArticlesRepo.getArticle(created.id);
  assert.equal(approved.knowledgeLifecycleState, 'approved');
  assert.equal(approved.knowledgeLifecycleBucket, 'approved_knowledge');

  await faqArticlesRepo.deleteArticle(created.id);
  const deleted = await faqArticlesRepo.getArticle(created.id);
  assert.equal(deleted.status, 'disabled');
  assert.equal(deleted.knowledgeLifecycleState, 'deprecated');
  assert.equal(deleted.knowledgeLifecycleBucket, 'candidate_knowledge');
});
