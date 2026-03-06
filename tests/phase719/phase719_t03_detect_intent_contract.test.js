'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { detectIntent } = require('../../src/domain/llm/router/detectIntent');

test('phase719: detectIntent classifies greeting/casual/question/problem/activity', () => {
  assert.equal(detectIntent({ messageText: 'こんにちは' }).mode, 'greeting');
  assert.equal(detectIntent({ messageText: '元気？' }).mode, 'casual');
  assert.equal(detectIntent({ messageText: '学校手続きどうする？' }).mode, 'question');
  assert.equal(detectIntent({ messageText: '詰まって進まない' }).mode, 'problem');
  assert.equal(detectIntent({ messageText: '週末どこ行く？' }).mode, 'activity');
});

test('phase719: detectIntent returns deterministic reasons', () => {
  assert.equal(detectIntent({ messageText: 'こんにちは' }).reason, 'greeting_detected');
  assert.equal(detectIntent({ messageText: 'ありがとう' }).reason, 'smalltalk_detected');
  assert.equal(detectIntent({ messageText: 'わからない' }).reason, 'blocked_signal');
  assert.equal(detectIntent({ messageText: '帰任前に何する？' }).reason, 'life_signal');
});
