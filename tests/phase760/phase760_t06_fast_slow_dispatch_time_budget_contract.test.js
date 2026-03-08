'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { classifyDispatchMode } = require('../../src/v1/channel_edge/line/dispatcher');

test('phase760: dispatcher classifies short text as fast and long text as slow', () => {
  assert.equal(classifyDispatchMode({ message: { text: 'こんにちは' } }).mode, 'fast');
  assert.equal(classifyDispatchMode({ message: { text: 'これはかなり長い説明が必要な相談です。'.repeat(4) } }).mode, 'slow');
});
