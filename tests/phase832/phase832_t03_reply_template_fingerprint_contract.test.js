'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  buildReplyTemplateFingerprint,
  classifyReplyTemplateKind,
  normalizeForReplyTemplateFingerprint
} = require('../../src/domain/llm/conversation/replyTemplateTelemetry');

test('phase832: reply template fingerprint normalizes ids, urls, and punctuation drift', () => {
  const left = '状況を整理しながら進めましょう。\nまずは次の一手です。\n・SSNを確認\nhttps://example.com/abc123\n受付番号 445566';
  const right = '状況を整理しながら進めます\nまずは次の一手です。\n・SSNを確認\nhttps://example.com/zzz999\n受付番号 778899';

  const leftFingerprint = buildReplyTemplateFingerprint(left);
  const rightFingerprint = buildReplyTemplateFingerprint(right);

  assert.ok(leftFingerprint);
  assert.equal(leftFingerprint, rightFingerprint);
  assert.match(leftFingerprint, /^rtf_[a-f0-9]{16}$/);
  assert.equal(classifyReplyTemplateKind({ replyText: left }), 'generic_fallback');
  assert.ok(!normalizeForReplyTemplateFingerprint(left).includes('example.com'));
  assert.ok(!normalizeForReplyTemplateFingerprint(left).includes('445566'));
});
