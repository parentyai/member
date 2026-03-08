'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { prepareLineMessages } = require('../../src/v1/line_renderer/lineChannelRenderer');
const { countUtf16Units } = require('../../src/v1/line_renderer/utf16Budgeter');

test('phase760: renderer keeps max 5 message objects and chunks UTF-16 text', () => {
  const input = [{ type: 'text', text: 'a'.repeat(5000) }, { type: 'text', text: 'b' }, { type: 'text', text: 'c' }, { type: 'text', text: 'd' }, { type: 'text', text: 'e' }, { type: 'text', text: 'f' }];
  const out = prepareLineMessages(input, { env: { LINE_TEXT_UTF16_BUDGET: '600' } });
  assert.ok(out.length <= 5);
  out.forEach((row) => {
    if (row.type === 'text') {
      assert.ok(countUtf16Units(row.text) <= 650);
    }
  });
});
