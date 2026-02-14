'use strict';

const assert = require('assert');
const { test } = require('node:test');

const deliveriesRepo = require('../../src/repos/firestore/deliveriesRepo');
const { testSendNotification } = require('../../src/usecases/notifications/testSendNotification');

test('phase72: testSendNotification sets sentAt/deliveredAt when missing', async () => {
  const originalReserve = deliveriesRepo.reserveDeliveryWithId;
  const originalCreate = deliveriesRepo.createDeliveryWithId;
  let captured = null;

  deliveriesRepo.reserveDeliveryWithId = async () => ({ existing: null });
  deliveriesRepo.createDeliveryWithId = async (_id, payload) => {
    captured = payload;
    return { id: 'delivery-1' };
  };

  try {
    const result = await testSendNotification({
      lineUserId: 'U1',
      deliveryId: 'delivery-1',
      pushFn: async () => {}
    });
    assert.ok(result && result.id, 'delivery id should be returned');
    assert.ok(captured, 'delivery payload should be captured');
    assert.ok(captured.sentAt, 'sentAt should be set');
    assert.ok(captured.deliveredAt, 'deliveredAt should be set');
  } finally {
    deliveriesRepo.reserveDeliveryWithId = originalReserve;
    deliveriesRepo.createDeliveryWithId = originalCreate;
  }
});
