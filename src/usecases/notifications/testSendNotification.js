'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { pushMessage } = require('../../infra/lineClient');
const { validateKillSwitch } = require('../../domain/validators');

function buildTextMessage(text) {
  return { type: 'text', text: text || '' };
}

async function testSendNotification(params) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  const text = payload.text || 'test message';
  const pushFn = payload.pushFn || pushMessage;

  if (!lineUserId) {
    throw new Error('lineUserId required');
  }

  validateKillSwitch(payload.killSwitch);

  await pushFn(lineUserId, buildTextMessage(text));

  const delivery = {
    notificationId: payload.notificationId || 'test',
    lineUserId,
    sentAt: payload.sentAt,
    delivered: true
  };
  const result = await deliveriesRepo.createDelivery(delivery);
  return { id: result.id };
}

module.exports = {
  testSendNotification
};
