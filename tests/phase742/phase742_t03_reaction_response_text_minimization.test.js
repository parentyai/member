'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { sanitizeReactionResponseText } = require('../../src/usecases/phase37/sanitizeReactionResponseText');
const { markDeliveryReactionV2 } = require('../../src/usecases/phase37/markDeliveryReactionV2');

test('phase742: sanitizeReactionResponseText blocks obvious email/phone patterns', () => {
  const email = sanitizeReactionResponseText('reach me at test.user@example.com');
  assert.equal(email.stored, false);
  assert.equal(email.reason, 'pii_pattern_detected');
  assert.equal(email.value, null);

  const phone = sanitizeReactionResponseText('my phone is +1 (212) 555-1234');
  assert.equal(phone.stored, false);
  assert.equal(phone.reason, 'pii_pattern_detected');
  assert.equal(phone.value, null);
});

test('phase742: markDeliveryReactionV2 does not persist blocked response text and keeps main flow', async () => {
  const calls = { deliveryPayload: null, eventPayload: null, auditPayload: null };
  const result = await markDeliveryReactionV2({
    deliveryId: 'd742_1',
    action: 'response',
    lineUserId: 'U742',
    responseText: 'email me: me@example.com',
    traceId: 'trace742',
    requestId: 'req742'
  }, {
    deliveriesRepo: {
      async markReactionV2(_deliveryId, _action, payload) {
        calls.deliveryPayload = payload;
        return { id: 'd742_1', lineUserId: 'U742' };
      }
    },
    auditLogsRepo: {
      async appendAuditLog(payload) {
        calls.auditPayload = payload;
      }
    },
    eventsRepo: {
      async createEvent(payload) {
        calls.eventPayload = payload;
      }
    },
    journeyTodoItemsRepo: {
      async getJourneyTodoItem() {
        return null;
      }
    },
    applyJourneyReactionBranch: async () => ({ ok: true, enabled: false, matchedRules: [], queuedCount: 0 })
  });

  assert.equal(result.ok, true);
  assert.equal(result.responseTextStored, false);
  assert.equal(result.responseTextPolicyReason, 'pii_pattern_detected');
  assert.equal(calls.deliveryPayload.responseText, null);
  assert.equal(calls.eventPayload.responseText, null);
  assert.equal(calls.auditPayload.responseTextStored, false);
});

test('phase742: response text storage can be disabled with feature flag', () => {
  const prev = process.env.ENABLE_REACTION_RESPONSE_TEXT_STORE_V1;
  process.env.ENABLE_REACTION_RESPONSE_TEXT_STORE_V1 = '0';
  try {
    const result = sanitizeReactionResponseText('plain message');
    assert.equal(result.stored, false);
    assert.equal(result.reason, 'feature_flag_off');
    assert.equal(result.value, null);
  } finally {
    if (prev === undefined) delete process.env.ENABLE_REACTION_RESPONSE_TEXT_STORE_V1;
    else process.env.ENABLE_REACTION_RESPONSE_TEXT_STORE_V1 = prev;
  }
});

