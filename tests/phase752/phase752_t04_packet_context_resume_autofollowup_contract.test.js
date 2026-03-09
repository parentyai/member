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
