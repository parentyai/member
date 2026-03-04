'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { selectConversationStyle } = require('../../src/domain/llm/conversation/styleRouter');

test('phase717: style router selects checklist for regulation and weekend for activity', () => {
  const regulation = selectConversationStyle({
    topic: 'visa',
    userTier: 'paid',
    question: 'ビザ更新の必要書類を教えて',
    messageLength: 18,
    timeOfDay: 10,
    urgency: 'normal'
  });
  assert.equal(regulation.styleId, 'Checklist');

  const weekend = selectConversationStyle({
    topic: 'activity',
    userTier: 'paid',
    question: '週末に子どもと行ける場所ある？',
    messageLength: 20,
    timeOfDay: 18,
    urgency: 'normal'
  });
  assert.equal(weekend.styleId, 'Weekend');
});

test('phase717: style router picks quick mode on urgent requests and asks clarification when confused', () => {
  const urgent = selectConversationStyle({
    topic: 'general',
    userTier: 'free',
    question: '至急 今日中に必要な手続きを教えて',
    messageLength: 15,
    timeOfDay: 9,
    urgency: 'high'
  });
  assert.equal(urgent.styleId, 'Quick');

  const confused = selectConversationStyle({
    topic: 'general',
    userTier: 'free',
    question: 'どうすればいいかわからない',
    messageLength: 14,
    timeOfDay: 9,
    urgency: 'normal'
  });
  assert.equal(confused.askClarifying, true);
});
