'use strict';

const deliveriesRepo = require('../../repos/firestore/deliveriesRepo');
const { pushMessage } = require('../../infra/lineClient');

const WELCOME_TEXT = '公式からのご案内はすべてこちらのLINEでお送りします。重要なお知らせは「公式連絡」からご確認ください。';
const WELCOME_NOTIFICATION_ID = 'welcome';

async function sendWelcomeMessage(params) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');

  const existing = await deliveriesRepo.listDeliveriesByUser(payload.lineUserId, 200);
  const alreadySent = existing.some((delivery) => delivery.notificationId === WELCOME_NOTIFICATION_ID);
  if (alreadySent) {
    return { skipped: true };
  }

  const pushFn = payload.pushFn || pushMessage;
  await pushFn(payload.lineUserId, { type: 'text', text: WELCOME_TEXT });

  const result = await deliveriesRepo.createDelivery({
    notificationId: WELCOME_NOTIFICATION_ID,
    lineUserId: payload.lineUserId,
    sentAt: payload.sentAt,
    delivered: true
  });

  return { id: result.id, skipped: false };
}

module.exports = {
  sendWelcomeMessage,
  WELCOME_TEXT,
  WELCOME_NOTIFICATION_ID
};
