'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CONTEXT_SIGNATURE_VERSION,
  buildContextSignature
} = require('../../src/domain/llm/bandit/contextualSignature');

test('phase726: contextual signature is stable for same bucketed features', () => {
  const payload = {
    featureVersion: 'bandit_ctx_v1',
    journeyPhase: 'pre',
    tier: 'paid',
    mode: 'B',
    topic: 'visa',
    riskBucket: 'high',
    evidenceNeed: 'required',
    intentConfidenceBucket: 'high',
    contextConfidenceBucket: 'medium',
    taskLoadBucket: 'light',
    lengthBucket: 'short',
    timingBucket: 'daytime',
    questionFlag: false,
    blockedTaskPresent: true,
    dueSoonTaskPresent: false
  };

  const a = buildContextSignature(payload);
  const b = buildContextSignature(Object.assign({}, payload));

  assert.equal(a, b);
  assert.ok(a.startsWith(`${CONTEXT_SIGNATURE_VERSION}_`));
});
