'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { normalizeLlmPolicy } = require('../../src/repos/firestore/opsConfigRepo');

test('phase665: llm policy normalize supports refusal_strategy and policy_version_id add-only fields', () => {
  const normalized = normalizeLlmPolicy({
    enabled: true,
    refusal_strategy: {
      mode: 'faq_only',
      show_blocked_reason: true,
      fallback: 'free_retrieval'
    },
    policy_version_id: 'jpv_20260226_abc123'
  });

  assert.ok(normalized);
  assert.deepEqual(normalized.refusal_strategy, {
    mode: 'faq_only',
    show_blocked_reason: true,
    fallback: 'free_retrieval'
  });
  assert.equal(normalized.policy_version_id, 'jpv_20260226_abc123');
});

test('phase665: webhook llm gate audit payload includes policyVersionId and refusalMode', () => {
  const src = fs.readFileSync('src/routes/webhookLine.js', 'utf8');
  assert.ok(src.includes('policyVersionId'));
  assert.ok(src.includes('refusalMode'));
  assert.ok(src.includes('resolveRefusalStrategy('));
});
