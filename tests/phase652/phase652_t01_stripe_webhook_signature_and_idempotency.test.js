'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const {
  parseStripeSignatureHeader,
  verifyStripeSignature,
  handleStripeWebhook
} = require('../../src/routes/webhookStripe');
const { processStripeWebhookEvent } = require('../../src/usecases/billing/processStripeWebhookEvent');

function signStripe(secret, timestamp, body) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${body}`, 'utf8')
    .digest('hex');
}

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase652: stripe signature parser and verifier accept canonical header', () => {
  const secret = 'whsec_test_1';
  const body = JSON.stringify({ id: 'evt_sig_ok' });
  const ts = Math.floor(Date.now() / 1000);
  const sig = signStripe(secret, ts, body);
  const header = `t=${ts},v1=${sig}`;

  const parsed = parseStripeSignatureHeader(header);
  assert.equal(parsed.timestamp, ts);
  assert.deepEqual(parsed.signatures, [sig]);

  const verifyOk = verifyStripeSignature(secret, body, header);
  assert.equal(verifyOk.ok, true);

  const verifyNg = verifyStripeSignature(secret, body, `t=${ts},v1=deadbeef`);
  assert.equal(verifyNg.ok, false);
  assert.equal(verifyNg.reason, 'invalid_signature');
});

test('phase652: handleStripeWebhook validates signature and records ignored event', async () => {
  const restoreEnv = withEnv({
    ENABLE_STRIPE_WEBHOOK: '1',
    STRIPE_WEBHOOK_SECRET: 'whsec_test_2'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const body = JSON.stringify({
      id: 'evt_ignore_1',
      type: 'invoice.paid',
      created: 1710000000,
      data: { object: { id: 'in_1' } }
    });
    const ts = Math.floor(Date.now() / 1000);
    const sig = signStripe(process.env.STRIPE_WEBHOOK_SECRET, ts, body);

    const invalid = await handleStripeWebhook({
      signature: `t=${ts},v1=invalid`,
      body,
      requestId: 'req_invalid',
      logger: () => {}
    });
    assert.equal(invalid.status, 401);

    const accepted = await handleStripeWebhook({
      signature: `t=${ts},v1=${sig}`,
      body,
      requestId: 'req_valid',
      logger: () => {}
    });
    assert.equal(accepted.status, 200);
    assert.equal(accepted.body, 'ok');

    const events = db._state.collections.stripe_webhook_events;
    assert.ok(events && events.docs && events.docs.evt_ignore_1);
    assert.equal(events.docs.evt_ignore_1.data.status, 'ignored');
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase652: processStripeWebhookEvent is idempotent and dead-letters metadata miss', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const event = {
      id: 'evt_sub_1',
      type: 'customer.subscription.updated',
      created: 1710000100,
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'active',
          current_period_end: 1711000000,
          metadata: { lineUserId: 'U_STRIPE_1' }
        }
      }
    };
    const rawBody = JSON.stringify(event);

    const first = await processStripeWebhookEvent({ event, rawBody, requestId: 'req_1' });
    const second = await processStripeWebhookEvent({ event, rawBody, requestId: 'req_1_replay' });

    assert.equal(first.status, 'processed');
    assert.equal(second.status, 'duplicate');

    const subscriptions = db._state.collections.user_subscriptions;
    assert.ok(subscriptions && subscriptions.docs && subscriptions.docs.U_STRIPE_1);
    assert.equal(subscriptions.docs.U_STRIPE_1.data.plan, 'pro');
    assert.equal(subscriptions.docs.U_STRIPE_1.data.status, 'active');
    assert.equal(subscriptions.docs.U_STRIPE_1.data.lastEventId, 'evt_sub_1');

    const events = db._state.collections.stripe_webhook_events;
    assert.ok(events && events.docs && events.docs.evt_sub_1);
    assert.equal(events.docs.evt_sub_1.data.status, 'processed');

    const metadataMissingEvent = {
      id: 'evt_sub_2',
      type: 'customer.subscription.updated',
      created: 1710000200,
      data: {
        object: {
          id: 'sub_2',
          customer: 'cus_2',
          status: 'active',
          current_period_end: 1711000200,
          metadata: {}
        }
      }
    };

    const deadLetter = await processStripeWebhookEvent({
      event: metadataMissingEvent,
      rawBody: JSON.stringify(metadataMissingEvent),
      requestId: 'req_2'
    });
    assert.equal(deadLetter.status, 'dead_letter');
    assert.equal(deadLetter.reason, 'metadata_lineUserId_missing');

    const deadLetters = db._state.collections.stripe_webhook_dead_letters;
    assert.ok(deadLetters && Object.keys(deadLetters.docs).length === 1);
    const deadLetterDoc = Object.values(deadLetters.docs)[0].data;
    assert.equal(deadLetterDoc.eventId, 'evt_sub_2');
    assert.equal(deadLetterDoc.errorCode, 'metadata_lineUserId_missing');

    assert.equal(events.docs.evt_sub_2.data.status, 'dead_letter');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
