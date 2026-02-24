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
const { generatePaidFaqReply } = require('../../src/usecases/assistant/generatePaidFaqReply');

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

async function seedFaqArticle(db) {
  await db.collection('faq_articles').doc('faq_1').set({
    status: 'active',
    locale: 'ja',
    riskLevel: 'low',
    version: '1.0.0',
    versionSemver: '1.0.0',
    validUntil: '2099-12-31T00:00:00.000Z',
    allowedIntents: ['FAQ'],
    title: '渡航前の必要書類チェック',
    body: '渡航前に必要な書類を確認してください。',
    keywords: ['渡航', '必要書類', 'チェック'],
    synonyms: ['書類確認'],
    tags: ['pre_departure'],
    updatedAt: '2026-02-24T00:00:00.000Z'
  }, { merge: true });
}

function buildAdapter() {
  return {
    answerFaq: async () => ({
      answer: {
        situation: '状況は把握できています。',
        gaps: ['必要書類の再確認が未完了です。'],
        risks: ['提出遅れによる手続き遅延リスクがあります。'],
        nextActions: ['書類チェックリストを本日中に更新する'],
        evidenceKeys: ['faq_1']
      },
      model: 'gpt-4o-mini',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20
      }
    })
  };
}

test('phase653: paid faq quality gate blocks when citation threshold is not met', async () => {
  const restoreEnv = withEnv({
    PAID_FAQ_MIN_TOP1_SCORE: '0',
    PAID_FAQ_MIN_CITATION_COUNT: '2'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await seedFaqArticle(db);

    const result = await generatePaidFaqReply({
      lineUserId: 'U_QUALITY_1',
      question: '渡航前に必要書類は何を確認すべきですか？',
      intent: 'gap_check',
      locale: 'ja',
      llmAdapter: buildAdapter()
    });

    assert.equal(result.ok, false);
    assert.equal(result.blockedReason, 'citation_missing');

    const logs = Object.values((db._state.collections.llm_quality_logs || { docs: {} }).docs || {});
    assert.equal(logs.length, 1);
    assert.equal(logs[0].data.userId, 'U_QUALITY_1');
    assert.equal(logs[0].data.decision, 'blocked');
    assert.equal(logs[0].data.blockedReason, 'citation_missing');
    assert.equal(logs[0].data.citationCount, 1);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase653: paid faq quality gate allows schema-compliant answer when threshold is satisfied', async () => {
  const restoreEnv = withEnv({
    PAID_FAQ_MIN_TOP1_SCORE: '0',
    PAID_FAQ_MIN_CITATION_COUNT: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    await seedFaqArticle(db);

    const result = await generatePaidFaqReply({
      lineUserId: 'U_QUALITY_2',
      question: '渡航前に必要書類は何を確認すべきですか？',
      intent: 'gap_check',
      locale: 'ja',
      llmAdapter: buildAdapter()
    });

    assert.equal(result.ok, true);
    assert.match(result.replyText, /^1\. 状況整理/m);
    assert.match(result.replyText, /^5\. 根拠参照キー/m);

    const logs = Object.values((db._state.collections.llm_quality_logs || { docs: {} }).docs || {});
    assert.equal(logs.length, 1);
    assert.equal(logs[0].data.userId, 'U_QUALITY_2');
    assert.equal(logs[0].data.decision, 'allow');
    assert.equal(logs[0].data.blockedReason, null);
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
