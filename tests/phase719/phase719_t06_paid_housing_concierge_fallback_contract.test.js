'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { generatePaidHousingConciergeReply } = require('../../src/usecases/assistant/generatePaidHousingConciergeReply');

function countActionBullets(text) {
  return String(text || '')
    .split('\n')
    .filter((line) => line.trim().startsWith('・'))
    .length;
}

test('phase719: paid housing fallback keeps natural format without retrieval template markers', () => {
  const result = generatePaidHousingConciergeReply({
    messageText: '部屋探ししたい',
    blockedReason: 'llm_disabled',
    contextSnapshot: {
      phase: 'arrival',
      topOpenTasks: [
        { key: 'housing_search', status: 'open' },
        { key: 'lease_document', status: 'open' }
      ]
    },
    opportunityDecision: {
      conversationMode: 'concierge',
      opportunityType: 'action',
      opportunityReasonKeys: ['housing_intent_detected'],
      interventionBudget: 1,
      suggestedAtoms: {
        nextActions: ['FAQ候補を確認する', 'score=1 を見る', '希望条件を3つに絞る'],
        pitfall: '根拠キーの確認漏れ',
        question: 'エリアはどこですか？'
      }
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.conversationMode, 'concierge');
  assert.equal(result.interventionBudget, 1);
  assert.ok(Array.isArray(result.opportunityReasonKeys));
  assert.ok(result.opportunityReasonKeys.includes('housing_intent'));
  assert.ok(result.opportunityReasonKeys.includes('housing_intent_detected'));
  assert.equal(result.replyText.includes('FAQ候補'), false);
  assert.equal(result.replyText.includes('CityPack候補'), false);
  assert.equal(result.replyText.includes('根拠キー'), false);
  assert.equal(result.replyText.includes('score='), false);
  assert.equal(result.replyText.includes('- [ ]'), false);
  assert.equal(countActionBullets(result.replyText) <= 3, true);
  assert.equal(result.auditMeta.evidenceOutcome, 'BLOCKED');
});

test('phase719: paid housing fallback returns deterministic concierge reply with optional question', () => {
  const result = generatePaidHousingConciergeReply({
    messageText: 'leaseで困ってる',
    contextSnapshot: null,
    opportunityDecision: null
  });

  assert.equal(result.ok, true);
  assert.equal(result.conversationMode, 'concierge');
  assert.equal(result.opportunityType, 'action');
  assert.equal(result.interventionBudget, 1);
  assert.equal(result.replyText.length > 0, true);
  assert.equal(countActionBullets(result.replyText) <= 3, true);
  assert.equal(result.auditMeta.evidenceOutcome, 'SUPPORTED');
});
