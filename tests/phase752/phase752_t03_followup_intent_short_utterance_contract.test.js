'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { resolveFollowupIntent } = require('../../src/domain/llm/orchestrator/followupIntentResolver');

test('phase752: domain anchored short utterance needs contextual carry to resolve followup intent', () => {
  const withoutCarry = resolveFollowupIntent({
    messageText: 'SSNha?',
    domainIntent: 'ssn'
  });
  assert.equal(withoutCarry.followupIntent, null);

  const decision = resolveFollowupIntent({
    messageText: 'SSNha?',
    domainIntent: 'ssn',
    contextResumeDomain: 'ssn',
    recentFollowupIntents: ['next_step']
  });
  assert.equal(decision.followupIntent, 'next_step');
  assert.equal(
    decision.reason === 'domain_anchored_short_followup' || decision.reason === 'next_step_keyword',
    true
  );
});

test('phase752: contextual short utterance resolves to next_step followup intent', () => {
  const decision = resolveFollowupIntent({
    messageText: '必要書類は',
    domainIntent: 'school'
  });
  assert.equal(decision.followupIntent, 'docs_required');
});
