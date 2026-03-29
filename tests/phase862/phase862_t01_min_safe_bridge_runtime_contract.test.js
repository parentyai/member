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
  getMinSafeApplyLeafRecord
} = require('../../src/domain/llm/closure/minSafeApplyRegistry');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase862: readiness bridge consumes registry-backed defaults without wording drift', () => {
  const source = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js');
  const clarify = applyAnswerReadinessDecision({ decision: 'clarify', replyText: 'unused' });
  const refuse = applyAnswerReadinessDecision({ decision: 'refuse', replyText: 'unused' });
  const hedged = applyAnswerReadinessDecision({ decision: 'hedged', replyText: '現在の整理です。' });

  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_paid_readiness_clarify_default'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_paid_readiness_refuse_default'"));
  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_paid_readiness_hedge_suffix'"));

  assert.equal(clarify.replyText, getMinSafeApplyLeafRecord('leaf_paid_readiness_clarify_default').literalText);
  assert.equal(refuse.replyText, getMinSafeApplyLeafRecord('leaf_paid_readiness_refuse_default').literalText);
  assert.equal(hedged.replyText, `現在の整理です。\n\n${getMinSafeApplyLeafRecord('leaf_paid_readiness_hedge_suffix').literalText}`);
});

test('phase862: finalizer refuse bridge stays parity-preserving and leaves non-target fallback untouched', () => {
  const source = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js');
  const refuse = finalizeCandidate({
    selected: { replyText: '' },
    readinessDecision: 'refuse'
  });

  assert.ok(source.includes("getMinSafeApplyLiteral('leaf_paid_finalizer_refuse'"));
  assert.ok(!source.includes("getMinSafeApplyLiteral('leaf_paid_finalizer_fallback'"));
  assert.equal(refuse.replyText, getMinSafeApplyLeafRecord('leaf_paid_finalizer_refuse').literalText);
});

test('phase862: renderer, welcome, and citypack bridges read registry-backed literals without shape drift', () => {
  const rendererSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/lineChannelRenderer.js');
  const welcomeSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js');
  const citypackSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js');

  assert.ok(rendererSource.includes("getMinSafeApplyLiteral('leaf_line_renderer_render_failure'"));
  assert.ok(welcomeSource.includes("getMinSafeApplyLiteral('leaf_welcome_message'"));
  assert.ok(citypackSource.includes("getMinSafeApplyLiteral('leaf_citypack_feedback_received'"));

  assert.deepEqual(prepareLineMessages([]), [{
    type: 'text',
    text: getMinSafeApplyLeafRecord('leaf_line_renderer_render_failure').literalText
  }]);
  assert.equal(WELCOME_TEXT, getMinSafeApplyLeafRecord('leaf_welcome_message').literalText);
  assert.equal(feedbackReceived(), getMinSafeApplyLeafRecord('leaf_citypack_feedback_received').literalText);
});
