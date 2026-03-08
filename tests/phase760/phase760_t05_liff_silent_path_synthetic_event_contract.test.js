'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { normalizeLiffSilentPayload } = require('../../src/v1/channel_edge/line/liffSilentNormalizer');

test('phase760: LIFF silent payload normalizer builds synthetic message event', () => {
  const result = normalizeLiffSilentPayload({ lineUserId: 'U123', text: 'hello' });
  assert.equal(result.ok, true);
  assert.equal(result.syntheticEvent._synthetic, true);
  assert.equal(result.syntheticEvent.message.type, 'text');
});
