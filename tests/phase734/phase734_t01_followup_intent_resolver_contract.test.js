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

  const typoDocs = resolveFollowupIntent({
    messageText: '手続きに必要なしょるい',
    domainIntent: 'school'
  });
  assert.equal(typoDocs.followupIntent, 'docs_required');
});

test('phase734: followup intent resolver avoids domain guess without domain context', () => {
  const unknown = resolveFollowupIntent({
    messageText: '必要書類',
    domainIntent: 'general'
  });
  assert.equal(unknown.followupIntent, null);
});

test('phase734: followup intent resolver keeps general planning continuations on next-step intent', () => {
  const nextStep = resolveFollowupIntent({
    messageText: 'それなら最初の5分は何をする？',
    domainIntent: 'general'
  });
  assert.equal(nextStep.followupIntent, 'next_step');

  const timeline = resolveFollowupIntent({
    messageText: '今日・今週・今月の順で短く並べて。',
    domainIntent: 'general'
  });
  assert.equal(timeline.followupIntent, 'next_step');
});

test('phase734: domain anchored short utterance needs carry context', () => {
  const noCarry = resolveFollowupIntent({
    messageText: 'SSNha?',
    domainIntent: 'ssn'
  });
  assert.equal(noCarry.followupIntent, null);

  const withCarry = resolveFollowupIntent({
    messageText: 'SSNha?',
    domainIntent: 'ssn',
    contextResumeDomain: 'ssn',
    recentFollowupIntents: ['next_step']
  });
  assert.equal(withCarry.followupIntent, 'next_step');
});
