'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildConversationPacket } = require('../../src/domain/llm/orchestrator/buildConversationPacket');

test('phase752: low-information contextual resume auto-fills next_step followup and context carry score', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT',
    messageText: '必要書類',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'ssn_application', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: null,
        committedNextActions: ['必要書類を先に整理する']
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'ssn');
  assert.equal(packet.followupIntent === 'next_step' || packet.followupIntent === 'docs_required', true);
  assert.equal(packet.routerReason, 'contextual_domain_resume');
  assert.equal(packet.contextCarryScore >= 0.8, true);
});

test('phase752: context resume cue without ultra-short message still resumes prior domain', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_CUE',
    messageText: 'それならどうする？',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'next_step',
        committedNextActions: ['対象校を1校に絞る']
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.contextResumeCue, true);
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(packet.followupIntent, 'next_step');
  assert.equal(packet.routerReason, 'contextual_domain_resume');
});

test('phase752: recovery correction prefers docs_required followup intent on contextual resume', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_RECOVERY',
    messageText: '違う、予約じゃなくて書類',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'ssn',
        followupIntent: 'appointment_needed',
        replyText: 'SSN窓口の予約要否を先に確認しましょう。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'ssn');
  assert.equal(packet.recoveryFollowupIntent, 'docs_required');
  assert.equal(packet.followupIntent, 'docs_required');
});

test('phase752: explicit housing correction does not get hijacked by prior school context', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_HOUSING_CORRECTION',
    messageText: 'それは違う。学校じゃなくて住まい優先で考え直して。',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'next_step',
        replyText: '学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.recoverySignal, true);
  assert.equal(packet.contextResume, false);
  assert.equal(packet.contextResumeDomain, null);
  assert.equal(packet.normalizedConversationIntent, 'housing');
});

test('phase752: history carry keeps previous followup intent for ultra-short confirmation turn', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_HISTORY',
    messageText: 'それで？',
    routerReason: 'default_casual',
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'school',
        followupIntent: 'docs_required',
        replyText: '学校手続きは住所証明と予防接種記録を先にそろえるのが最優先です。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, true);
  assert.equal(packet.normalizedConversationIntent, 'school');
  assert.equal(packet.followupIntent, 'docs_required');
  assert.equal(packet.followupIntentReason, 'history_followup_carry');
  assert.equal(packet.followupCarryFromHistory, true);
  assert.equal(packet.contextCarryScore >= 0.85, true);
});

test('phase752: snapshot domain does not hijack general planning followup without prior domain history', () => {
  const packet = buildConversationPacket({
    lineUserId: 'U_PHASE752_PKT_GENERAL',
    messageText: 'それなら最初の5分は何をする？',
    routerReason: 'default_casual',
    contextSnapshot: {
      topOpenTasks: [{ key: 'school_registration', status: 'open' }]
    },
    recentActionRows: [
      {
        createdAt: new Date().toISOString(),
        domainIntent: 'general',
        followupIntent: 'next_step',
        replyText: '優先する3つは、期限が近いこと、後続に影響すること、今日すぐ動かせることです。'
      }
    ],
    llmFlags: {}
  });

  assert.equal(packet.contextResume, false);
  assert.equal(packet.contextResumeDomain, null);
  assert.equal(packet.normalizedConversationIntent, 'general');
  assert.equal(packet.followupIntent, 'next_step');
});
