'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const {
  getMinSafeApplyLeafRecord
} = require('../../src/domain/llm/closure/minSafeApplyRegistry');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const REPO_ROOT = path.resolve(__dirname, '../..');

test('phase861: min safe apply registry stays aligned with webhook top-level literals', () => {
  const source = read(path.join(REPO_ROOT, 'src/routes/webhookLine.js'));

  assert.equal(
    getMinSafeApplyLeafRecord('leaf_webhook_guard_missing_reply_fallback').literalText,
    '状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。'
  );
  assert.equal(
    getMinSafeApplyLeafRecord('leaf_webhook_retrieval_failure_fallback').literalText,
    '関連情報を取得できませんでした。'
  );
  assert.equal(
    getMinSafeApplyLeafRecord('leaf_webhook_readiness_clarify').literalText,
    'まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。'
  );
  assert.equal(
    getMinSafeApplyLeafRecord('leaf_webhook_readiness_refuse').literalText,
    'この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。'
  );
  assert.equal(
    getMinSafeApplyLeafRecord('leaf_webhook_synthetic_ack').literalText,
    '受け取りました。続けて状況を一緒に整理します。'
  );

  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_guard_missing_reply_fallback'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_retrieval_failure_fallback'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_readiness_clarify'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_readiness_refuse'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_webhook_synthetic_ack'"));
  assert.ok(source.includes(getMinSafeApplyLeafRecord('leaf_webhook_guard_missing_reply_fallback').literalText));
  assert.ok(source.includes(getMinSafeApplyLeafRecord('leaf_webhook_retrieval_failure_fallback').literalText));
  assert.ok(source.includes(getMinSafeApplyLeafRecord('leaf_webhook_readiness_clarify').literalText));
  assert.ok(source.includes(getMinSafeApplyLeafRecord('leaf_webhook_readiness_refuse').literalText));
  assert.ok(source.includes(getMinSafeApplyLeafRecord('leaf_webhook_synthetic_ack').literalText));
});

test('phase861: min safe apply registry route metadata stays locked for webhook leaves', () => {
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_guard_missing_reply_fallback').primaryRoute, 'POST /webhook/line top-level');
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_guard_missing_reply_fallback').outputShape, 'fallback_text');
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_retrieval_failure_fallback').outputShape, 'fallback_text');
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_readiness_clarify').outputShape, 'clarify_prompt');
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_readiness_refuse').outputShape, 'refuse_text');
  assert.equal(getMinSafeApplyLeafRecord('leaf_webhook_synthetic_ack').outputShape, 'command_ack');
});
