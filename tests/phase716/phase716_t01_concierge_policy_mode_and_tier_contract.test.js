'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  resolvePolicyForRequest,
  detectTopic,
  decideMode
} = require('../../src/domain/llm/conciergePolicy');

test('phase716: topic classifier and mode decider map regulated intents to Mode B', () => {
  assert.equal(detectTopic('visa update deadline'), 'visa');
  assert.equal(decideMode('visa'), 'B');

  assert.equal(detectTopic('tax filing in japan'), 'tax');
  assert.equal(decideMode('tax'), 'B');

  assert.equal(detectTopic('medical insurance rules'), 'medical');
  assert.equal(decideMode('medical'), 'B');

  assert.equal(detectTopic('school admission timeline'), 'school');
  assert.equal(decideMode('school'), 'B');
});

test('phase716: activity intent maps to Mode C and general maps to Mode A', () => {
  assert.equal(detectTopic('weekend activities in tokyo'), 'activity');
  assert.equal(decideMode('activity'), 'C');

  assert.equal(detectTopic('how to organize tasks this week'), 'general');
  assert.equal(decideMode('general'), 'A');
});

test('phase716: tier policy enforces free/paid URL cap and external search boundary', () => {
  const freeB = resolvePolicyForRequest({
    question: 'visa extension rules',
    userTier: 'free'
  });
  assert.equal(freeB.mode, 'B');
  assert.equal(freeB.maxUrls, 1);
  assert.equal(freeB.storedOnly, true);
  assert.equal(freeB.allowExternalSearch, false);
  assert.deepEqual(freeB.allowedRanks, ['R0', 'R1']);

  const paidC = resolvePolicyForRequest({
    question: 'weekend activity recommendations',
    userTier: 'paid'
  });
  assert.equal(paidC.mode, 'C');
  assert.equal(paidC.maxUrls, 3);
  assert.equal(paidC.storedOnly, false);
  assert.equal(paidC.allowExternalSearch, true);
  assert.deepEqual(paidC.allowedRanks, ['R0', 'R1', 'R2']);

  const paidA = resolvePolicyForRequest({
    question: 'organize my schedule',
    userTier: 'paid'
  });
  assert.equal(paidA.mode, 'A');
  assert.equal(paidA.maxUrls, 0);
});
