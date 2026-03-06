'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIntent } = require('../../src/domain/llm/router/detectIntent');

test('phase719: detectIntent classifies greeting/casual/question/problem/activity', () => {
  assert.equal(detectIntent({ messageText: 'こんにちは' }).mode, 'greeting');
  assert.equal(detectIntent({ messageText: '元気？' }).mode, 'casual');
  assert.equal(detectIntent({ messageText: '税金どうする？' }).mode, 'question');
  assert.equal(detectIntent({ messageText: '次の行動を整理して' }).mode, 'question');
  assert.equal(detectIntent({ messageText: '詰まって進まない' }).mode, 'problem');
  assert.equal(detectIntent({ messageText: '週末どこ行く？' }).mode, 'activity');
});

test('phase719: detectIntent normalizes domain keywords into problem mode', () => {
  ['部屋探ししたい', '住宅', '賃貸', 'lease', 'apartment'].forEach((messageText) => {
    const result = detectIntent({ messageText });
    assert.equal(result.mode, 'problem');
    assert.equal(result.reason, 'housing_intent_detected');
  });
  ['学校手続きどうする？', '学区', 'enrollment', 'SSN申請', 'social security', '銀行口座', 'bank account'].forEach((messageText) => {
    const result = detectIntent({ messageText });
    assert.equal(result.mode, 'problem');
    assert.ok(/_intent_detected$/.test(result.reason));
  });
});

test('phase719: detectIntent returns deterministic reasons', () => {
  assert.equal(detectIntent({ messageText: 'こんにちは' }).reason, 'greeting_detected');
  assert.equal(detectIntent({ messageText: 'ありがとう' }).reason, 'smalltalk_detected');
  assert.equal(detectIntent({ messageText: 'わからない' }).reason, 'blocked_signal');
  assert.equal(detectIntent({ messageText: '帰任前に何する？' }).reason, 'life_signal');
  assert.equal(detectIntent({ messageText: '家探しで困ってる' }).reason, 'housing_intent_detected');
  assert.equal(detectIntent({ messageText: 'school district どうする？' }).reason, 'school_intent_detected');
  assert.equal(detectIntent({ messageText: 'SSN 申請したい' }).reason, 'ssn_intent_detected');
  assert.equal(detectIntent({ messageText: 'bank account 作りたい' }).reason, 'banking_intent_detected');
});
