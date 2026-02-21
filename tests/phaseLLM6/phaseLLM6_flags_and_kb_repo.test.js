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

const systemFlagsRepo = require('../../src/repos/firestore/systemFlagsRepo');
const faqArticlesRepo = require('../../src/repos/firestore/faqArticlesRepo');

function iso(s) {
  return new Date(s).toISOString();
}

test('phaseLLM6: llmEnabled defaults false and can be persisted', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const initial = await systemFlagsRepo.getLlmEnabled();
  assert.strictEqual(initial, false);

  await systemFlagsRepo.setLlmEnabled(true);
  const after = await systemFlagsRepo.getLlmEnabled();
  assert.strictEqual(after, true);
});

test('phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows', async (t) => {
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
    synonyms: ['member number'],
    tags: ['account'],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: [],
    version: '1.0.0',
    validUntil: iso('2099-12-31T00:00:00Z'),
    updatedAt: iso('2026-02-16T00:00:00Z')
  });
  await db.collection('faq_articles').doc('a2').set({
    title: '支払い',
    body: '支払い方法です',
    keywords: ['支払い'],
    synonyms: [],
    tags: ['billing'],
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: [],
    version: '1.0.0',
    validUntil: iso('2099-12-31T00:00:00Z'),
    updatedAt: iso('2026-02-15T00:00:00Z')
  });
  await db.collection('faq_articles').doc('a3').set({
    title: 'old',
    body: 'old',
    keywords: ['会員番号'],
    synonyms: [],
    tags: [],
    status: 'archived',
    locale: 'ja',
    riskLevel: 'low',
    allowedIntents: [],
    version: '1.0.0',
    validUntil: iso('2099-12-31T00:00:00Z'),
    updatedAt: iso('2026-02-17T00:00:00Z')
  });

  const rows = await faqArticlesRepo.searchActiveArticles({ query: '会員番号 確認', locale: 'ja', limit: 2 });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].id, 'a1');
  assert.strictEqual(rows[1].id, 'a2');
});
