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
