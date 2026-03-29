'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  getMinSafeApplyLeafRecord
} = require('../../src/domain/llm/closure/minSafeApplyRegistry');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase862: webhook bridge uses registry-backed literals with existing fallback text preserved', () => {
  const source = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

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

test('phase862: webhook bridge does not expand into intentionally excluded webhook leaves', () => {
  const source = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');
  const rendererSource = read('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/fallbackRenderer.js');

  assert.ok(!source.includes("getMinSafeApplyLiteral('leaf_webhook_low_relevance_clarify'"));
  assert.ok(!rendererSource.includes("getMinSafeApplyLiteral('leaf_line_renderer_overflow_summary'"));
  assert.ok(!rendererSource.includes("getMinSafeApplyLiteral('leaf_line_renderer_deeplink_generic'"));
});
