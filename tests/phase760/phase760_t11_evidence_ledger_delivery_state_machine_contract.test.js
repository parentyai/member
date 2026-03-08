'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { applyDeliveryTransition } = require('../../src/v1/evidence_ledger/deliveryStateMachine');

test('phase760: delivery state machine allows only valid transitions', () => {
  const ok = applyDeliveryTransition({ state: 'queued' }, 'reply_sent');
  const ng = applyDeliveryTransition({ state: 'completed' }, 'reply_sent');
  assert.equal(ok.ok, true);
  assert.equal(ng.ok, false);
});
