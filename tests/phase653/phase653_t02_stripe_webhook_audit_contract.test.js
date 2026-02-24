'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { processStripeWebhookEvent } = require('../../src/usecases/billing/processStripeWebhookEvent');

function buildSubscriptionEvent(id, created, lineUserId, status) {
  return {
    id,
    type: 'customer.subscription.updated',
    created,
    data: {
      object: {
        id: `sub_${lineUserId}`,
        customer: `cus_${lineUserId}`,
        status: status || 'active',
        current_period_end: created + 3600,
        metadata: { lineUserId }
      }
    }
  };
}

test('phase653: stripe webhook writes sub_updated / webhook_replay / sub_conflict audit actions', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const processedEvent = buildSubscriptionEvent('evt_phase653_processed', 1710001000, 'U_PHASE653_STRIPE_1', 'active');
    const processed = await processStripeWebhookEvent({
      event: processedEvent,
      rawBody: JSON.stringify(processedEvent),
      requestId: 'req_phase653_processed'
    });
    assert.equal(processed.status, 'processed');

    const replayed = await processStripeWebhookEvent({
      event: processedEvent,
      rawBody: JSON.stringify(processedEvent),
      requestId: 'req_phase653_replay'
    });
    assert.equal(replayed.status, 'duplicate');

    const staleEvent = buildSubscriptionEvent('evt_phase653_stale', 1710000000, 'U_PHASE653_STRIPE_1', 'trialing');
    const stale = await processStripeWebhookEvent({
      event: staleEvent,
      rawBody: JSON.stringify(staleEvent),
      requestId: 'req_phase653_stale'
    });
    assert.equal(stale.status, 'stale_ignored');

    const audits = db._state.collections.audit_logs;
    const actions = audits
      ? Object.values(audits.docs).map((entry) => entry && entry.data && entry.data.action).filter(Boolean)
      : [];

    assert.ok(actions.includes('sub_updated'));
    assert.ok(actions.includes('webhook_replay'));
    assert.ok(actions.includes('sub_conflict'));
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
