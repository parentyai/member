'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { generateFreeRetrievalReply } = require('../../src/usecases/assistant/generateFreeRetrievalReply');

async function runWithQuestion(question) {
  return generateFreeRetrievalReply({
    lineUserId: 'U717STYLE',
    question,
    locale: 'ja'
  }, {
    searchFaqFromKb: async () => ({
      ok: true,
      mode: 'ranked',
      candidates: [
        { articleId: 'kb_visa_renew', title: 'ビザ更新', searchScore: 9.1 }
      ]
    }),
    searchCityPackCandidates: async () => ({
      ok: true,
      mode: 'ranked',
      candidates: [
        { sourceId: 'cp_tokyo_visa', title: '東京ビザ手続き', reason: 'city_pack_match' }
      ]
    })
  });
}

test('phase717: free retrieval reply style varies between urgent and checklist-like prompts', async () => {
  const urgent = await runWithQuestion('至急 ビザ更新の手順');
  const regular = await runWithQuestion('ビザ更新の手順');

  assert.equal(urgent.ok, true);
  assert.equal(regular.ok, true);
  assert.notEqual(urgent.replyText, regular.replyText);
  assert.ok(urgent.replyText.includes('まずこの順です'));
  assert.ok(regular.replyText.includes('チェックリスト') || regular.replyText.includes('この順で進めると迷いにくいです。'));
  assert.ok(urgent.replyText.includes('根拠キー: kb_visa_renew'));
  assert.ok(regular.replyText.includes('根拠キー: cp_tokyo_visa'));
});
