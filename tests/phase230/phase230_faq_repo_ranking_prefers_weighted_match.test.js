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

test('phase230: faq repo ranking prefers keyword > synonym > tag matches', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('faq_articles').doc('k1').set({
    title: '会員番号の確認',
    body: '確認手順',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    validUntil: iso('2026-03-01T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });

  await db.collection('faq_articles').doc('s1').set({
    title: '番号の確認',
    body: '確認手順',
    keywords: [],
    synonyms: ['会員番号'],
    tags: [],
    status: 'active',
    locale: 'ja',
    validUntil: iso('2026-03-01T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });

  await db.collection('faq_articles').doc('t1').set({
    title: '番号の確認',
    body: '確認手順',
    keywords: [],
    synonyms: [],
    tags: ['会員番号'],
    status: 'active',
    locale: 'ja',
    validUntil: iso('2026-03-01T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });

  const rows = await faqArticlesRepo.searchActiveArticles({
    query: '会員番号',
    locale: 'ja',
    limit: 3,
    now: new Date('2026-02-17T00:00:00Z')
  });

  assert.deepStrictEqual(rows.map((row) => row.id), ['k1', 's1', 't1']);
  assert.ok(rows.every((row) => Number.isFinite(row.searchScore)));
  assert.ok(rows[0].searchScore > rows[1].searchScore);
  assert.ok(rows[1].searchScore > rows[2].searchScore);
});
