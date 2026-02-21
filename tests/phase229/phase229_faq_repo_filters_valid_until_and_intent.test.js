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
const faqArticlesRepo = require('../../src/repos/firestore/faqArticlesRepo');

function iso(s) {
  return new Date(s).toISOString();
}

test('phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('faq_articles').doc('a1').set({
    title: '会員番号の確認',
    body: '会員番号の確認方法です',
    keywords: ['会員番号', '確認'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-02-20T00:00:00Z'),
    updatedAt: iso('2026-02-16T00:00:00Z')
  });
  await db.collection('faq_articles').doc('a2').set({
    title: '期限切れ記事',
    body: 'old',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    version: '1.0.0',
    validUntil: iso('2026-02-10T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });
  await db.collection('faq_articles').doc('a3').set({
    title: 'FAQ非許可',
    body: 'billing only',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: ['BILLING'],
    version: '1.0.0',
    validUntil: iso('2026-02-20T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });
  await db.collection('faq_articles').doc('a4').set({
    title: 'intent未指定互換',
    body: 'fallback',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: [],
    version: '1.0.0',
    validUntil: iso('2026-02-20T00:00:00Z'),
    updatedAt: iso('2026-02-15T00:00:00Z')
  });

  const rows = await faqArticlesRepo.searchActiveArticles({
    query: '会員番号',
    locale: 'ja',
    now: new Date('2026-02-17T00:00:00Z'),
    limit: 10
  });
  const ids = rows.map((row) => row.id);
  assert.deepStrictEqual(ids, ['a1', 'a4']);
});
