'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { applyAnswerReadinessDecision } = require('../../src/domain/llm/quality/applyAnswerReadinessDecision');
const { finalizeCandidate } = require('../../src/domain/llm/orchestrator/finalizeCandidate');
const { prepareLineMessages } = require('../../src/v1/line_renderer/lineChannelRenderer');
const { WELCOME_TEXT } = require('../../src/usecases/notifications/sendWelcomeMessage');
const { feedbackReceived } = require('../../src/domain/cityPackFeedbackMessages');
const {
  MIN_SAFE_APPLY_REGISTRY_VERSION,
  SAFE_MIN_APPLY_LEAF_IDS,
  getMinSafeApplyLeafRecord,
  buildMinSafeApplyTextPayload
} = require('../../src/domain/llm/closure/minSafeApplyRegistry');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase861: min safe apply registry is locked to the 12 approved leaves only', () => {
  assert.equal(MIN_SAFE_APPLY_REGISTRY_VERSION, '2026-03-19');
  assert.deepEqual(SAFE_MIN_APPLY_LEAF_IDS, [
    'leaf_citypack_feedback_received',
    'leaf_line_renderer_render_failure',
    'leaf_paid_finalizer_refuse',
    'leaf_paid_readiness_clarify_default',
    'leaf_paid_readiness_hedge_suffix',
    'leaf_paid_readiness_refuse_default',
    'leaf_webhook_guard_missing_reply_fallback',
    'leaf_webhook_readiness_clarify',
    'leaf_webhook_readiness_refuse',
    'leaf_webhook_retrieval_failure_fallback',
    'leaf_webhook_synthetic_ack',
    'leaf_welcome_message'
  ]);
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_finalizer_fallback'), null);
  assert.equal(getMinSafeApplyLeafRecord('leaf_free_retrieval_empty_reply'), null);
});

test('phase861: min safe apply registry stays exact for helper-backed literals', () => {
  const clarify = applyAnswerReadinessDecision({ decision: 'clarify', replyText: 'unused' });
  const refuse = applyAnswerReadinessDecision({ decision: 'refuse', replyText: 'unused' });
  const hedged = applyAnswerReadinessDecision({ decision: 'hedged', replyText: '現在の整理です。' });
  const finalizedRefuse = finalizeCandidate({
    selected: { replyText: '' },
    readinessDecision: 'refuse'
  });
  const renderFailure = prepareLineMessages([])[0];

  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_clarify_default').literalText, clarify.replyText);
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_refuse_default').literalText, refuse.replyText);
  assert.equal(
    getMinSafeApplyLeafRecord('leaf_paid_readiness_hedge_suffix').literalText,
    hedged.replyText.split('\n\n')[1]
  );
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_finalizer_refuse').literalText, finalizedRefuse.replyText);
  assert.equal(getMinSafeApplyLeafRecord('leaf_line_renderer_render_failure').literalText, renderFailure.text);
  assert.equal(getMinSafeApplyLeafRecord('leaf_welcome_message').literalText, WELCOME_TEXT);
  assert.equal(getMinSafeApplyLeafRecord('leaf_citypack_feedback_received').literalText, feedbackReceived());
});

test('phase861: min safe apply registry produces text payloads without changing wording', () => {
  for (const leafId of SAFE_MIN_APPLY_LEAF_IDS) {
    const record = getMinSafeApplyLeafRecord(leafId);
    assert.equal(record.messageType, 'text');
    assert.deepEqual(buildMinSafeApplyTextPayload(leafId), {
      type: 'text',
      text: record.literalText
    });
  }
});

test('phase861: min safe apply registry preserves route and output-shape metadata for helper-backed leaves', () => {
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_clarify_default').primaryRoute, 'paid orchestrator');
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_clarify_default').outputShape, 'clarify_prompt');
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_refuse_default').outputShape, 'refuse_text');
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_readiness_hedge_suffix').outputShape, 'disclaimer_block');
  assert.equal(getMinSafeApplyLeafRecord('leaf_paid_finalizer_refuse').outputShape, 'refuse_text');
  assert.equal(getMinSafeApplyLeafRecord('leaf_welcome_message').primaryRoute, 'welcome push flow');
  assert.equal(getMinSafeApplyLeafRecord('leaf_line_renderer_render_failure').primaryRoute, 'renderer fallback');
  assert.equal(getMinSafeApplyLeafRecord('leaf_citypack_feedback_received').primaryRoute, 'journey direct command parser');
});
