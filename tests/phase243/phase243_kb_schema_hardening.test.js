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

test('phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  await db.collection('faq_articles').doc('v1').set({
    title: '会員番号の確認',
    body: '会員番号の確認方法',
    keywords: ['会員番号'],
    synonyms: [],
    tags: ['member'],
    status: 'active',
    locale: 'ja',
    version: '1.2.3',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    validUntil: iso('2026-03-01T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });
  await db.collection('faq_articles').doc('legacy').set({
    title: '会員番号の再確認',
    body: 'legacy semver field',
    keywords: ['会員番号'],
    synonyms: [],
    tags: ['member'],
    status: 'active',
    locale: 'ja',
    versionSemver: '2.0.0',
    riskLevel: 'medium',
    allowedIntents: ['FAQ'],
    validUntil: iso('2026-03-01T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:01Z')
  });
  await db.collection('faq_articles').doc('bad-version').set({
    title: '不正バージョン',
    body: 'invalid',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    version: 'v1',
    riskLevel: 'low',
    allowedIntents: ['FAQ'],
    validUntil: iso('2026-03-01T00:00:00Z')
  });
  await db.collection('faq_articles').doc('bad-risk').set({
    title: '不正risk',
    body: 'invalid',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    version: '1.0.0',
    riskLevel: 'critical',
    allowedIntents: ['FAQ'],
    validUntil: iso('2026-03-01T00:00:00Z')
  });
  await db.collection('faq_articles').doc('bad-intents').set({
    title: '不正intents',
    body: 'invalid',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'active',
    locale: 'ja',
    version: '1.0.0',
    riskLevel: 'low',
    allowedIntents: 'FAQ',
    validUntil: iso('2026-03-01T00:00:00Z')
  });

  const rows = await faqArticlesRepo.searchActiveArticles({
    query: '会員番号',
    locale: 'ja',
    now: new Date('2026-02-18T00:00:00Z'),
    limit: 10
  });

  const ids = rows.map((row) => row.id);
  assert.deepStrictEqual(ids, ['v1', 'legacy']);
  assert.strictEqual(rows[0].version, '1.2.3');
  assert.strictEqual(rows[0].versionSemver, '1.2.3');
  assert.strictEqual(rows[1].version, '2.0.0');
  assert.strictEqual(rows[1].versionSemver, '2.0.0');
});
