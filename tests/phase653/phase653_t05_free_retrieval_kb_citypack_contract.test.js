'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { generateFreeRetrievalReply } = require('../../src/usecases/assistant/generateFreeRetrievalReply');

test('phase653: free retrieval enforces faq_search intent and returns citation keys', async () => {
  const calls = [];
  const result = await generateFreeRetrievalReply({
    lineUserId: 'U100',
    question: 'ビザ更新の手順',
    locale: 'ja'
  }, {
    searchFaqFromKb: async (params) => {
      calls.push(params);
      return {
        ok: true,
        mode: 'ranked',
        candidates: [
          { articleId: 'kb_visa_renew', title: 'ビザ更新', searchScore: 9.1 }
        ]
      };
    },
    searchCityPackCandidates: async () => ({
      ok: true,
      mode: 'ranked',
      candidates: [
        { sourceId: 'cp_tokyo_visa', title: '東京ビザ手続き', reason: 'city_pack_match' }
      ]
    })
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].intent, 'faq_search');
  assert.equal(result.ok, true);
  assert.equal(result.mode, 'ranked');
  assert.ok(result.replyText.includes('根拠キー: kb_visa_renew'));
  assert.ok(result.replyText.includes('根拠キー: cp_tokyo_visa'));
  assert.ok(result.citations.includes('kb_visa_renew'));
  assert.ok(result.citations.includes('cp_tokyo_visa'));
});

test('phase653: free retrieval empty mode shows fallback guidance', async () => {
  const result = await generateFreeRetrievalReply({
    lineUserId: 'U200',
    question: '未知の質問',
    locale: 'ja'
  }, {
    searchFaqFromKb: async () => ({ ok: true, mode: 'empty', candidates: [] }),
    searchCityPackCandidates: async () => ({ ok: true, mode: 'empty', candidates: [] })
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'empty');
  assert.equal(result.citations.length, 0);
  assert.ok(result.replyText.includes('見つかりませんでした'));
  assert.ok(result.replyText.includes('お問い合わせ'));
});
