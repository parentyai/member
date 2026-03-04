'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  CONTEXTUAL_FEATURE_VERSION,
  buildContextualFeatures
} = require('../../src/domain/llm/bandit/contextualFeatures');

test('phase725: contextual feature builder normalizes bounded feature payload', () => {
  const features = buildContextualFeatures({
    mode: 'B',
    topic: 'visa',
    userTier: 'paid',
    journeyPhase: 'in-assignment',
    riskBucket: 'high',
    evidenceNeed: 'required',
    intentConfidence: 0.88,
    contextConfidence: 0.34,
    contextSnapshot: {
      topTasks: [{ key: 't1' }, { key: 't2' }, { key: 't3' }],
      blockedTask: { key: 't1' },
      dueSoonTask: { key: 't2' }
    },
    chosenAction: {
      styleId: 'Checklist',
      ctaCount: 2,
      lengthBucket: 'medium',
      timingBucket: 'morning',
      questionFlag: true
    }
  });

  assert.equal(features.featureVersion, CONTEXTUAL_FEATURE_VERSION);
  assert.equal(features.mode, 'B');
  assert.equal(features.topic, 'visa');
  assert.equal(features.tier, 'paid');
  assert.equal(features.taskLoadBucket, 'medium');
  assert.equal(features.intentConfidenceBucket, 'high');
  assert.equal(features.contextConfidenceBucket, 'low');
  assert.equal(features.blockedTaskPresent, true);
  assert.equal(features.dueSoonTaskPresent, true);
});
