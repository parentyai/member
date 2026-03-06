'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { generatePaidHousingConciergeReply } = require('../../src/usecases/assistant/generatePaidHousingConciergeReply');
const { generatePaidDomainConciergeReply } = require('../../src/usecases/assistant/generatePaidDomainConciergeReply');

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

test('phase719: paid domain fallback keeps natural format for school/ssn/banking', () => {
  const samples = [
    { domainIntent: 'school', messageText: '学校手続きで困ってる', reason: 'school_intent' },
    { domainIntent: 'ssn', messageText: 'SSN申請で詰まりそう', reason: 'ssn_intent' },
    { domainIntent: 'banking', messageText: 'bank accountを作りたい', reason: 'banking_intent' }
  ];
  samples.forEach((sample) => {
    const result = generatePaidDomainConciergeReply({
      domainIntent: sample.domainIntent,
      messageText: sample.messageText,
      blockedReason: 'llm_disabled',
      opportunityDecision: {
        conversationMode: 'concierge',
        opportunityType: 'action',
        opportunityReasonKeys: [`${sample.reason}_detected`],
        interventionBudget: 1,
        suggestedAtoms: {
          nextActions: ['FAQ候補を確認する', 'score=1 を見る', '次の一手を整理する'],
          pitfall: '根拠キーの確認漏れ',
          question: '状況を教えてください。'
        }
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.domainIntent, sample.domainIntent);
    assert.equal(result.conversationMode, 'concierge');
    assert.equal(result.replyText.includes('FAQ候補'), false);
    assert.equal(result.replyText.includes('CityPack候補'), false);
    assert.equal(result.replyText.includes('根拠キー'), false);
    assert.equal(result.replyText.includes('score='), false);
    assert.equal(result.replyText.includes('- [ ]'), false);
    assert.equal(countActionBullets(result.replyText) <= 3, true);
    assert.ok(result.opportunityReasonKeys.includes(sample.reason));
  });
});
