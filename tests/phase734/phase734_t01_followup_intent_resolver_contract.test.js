'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveFollowupIntent } = require('../../src/domain/llm/orchestrator/followupIntentResolver');

test('phase734: followup intent resolver detects docs/appointment/next-step intents', () => {
  const docs = resolveFollowupIntent({
    messageText: 'SSNの必要書類は？',
    domainIntent: 'ssn'
  });
  assert.equal(docs.followupIntent, 'docs_required');

  const appointment = resolveFollowupIntent({
    messageText: '予約するの？',
    domainIntent: 'ssn'
  });
  assert.equal(appointment.followupIntent, 'appointment_needed');

  const nextStep = resolveFollowupIntent({
    messageText: '後は何？',
    domainIntent: 'school'
  });
  assert.equal(nextStep.followupIntent, 'next_step');
});

test('phase734: followup intent resolver avoids domain guess without domain context', () => {
  const unknown = resolveFollowupIntent({
    messageText: '必要書類',
    domainIntent: 'general'
  });
  assert.equal(unknown.followupIntent, null);
});
