'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'stripe_webhook_dead_letters';

async function appendStripeWebhookDeadLetter(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const db = getDb();
  const docRef = db.collection(COLLECTION).doc();
  const data = {
    eventId: typeof payload.eventId === 'string' && payload.eventId.trim() ? payload.eventId.trim() : null,
    errorCode: typeof payload.errorCode === 'string' && payload.errorCode.trim() ? payload.errorCode.trim() : 'unknown',
    errorMessage: typeof payload.errorMessage === 'string' && payload.errorMessage.trim() ? payload.errorMessage.trim().slice(0, 500) : 'unknown',
    payloadHash: typeof payload.payloadHash === 'string' && payload.payloadHash.trim() ? payload.payloadHash.trim() : null,
    requestId: typeof payload.requestId === 'string' && payload.requestId.trim() ? payload.requestId.trim() : null,
    createdAt: payload.createdAt || serverTimestamp()
  };
  await docRef.set(data, { merge: false });
  return { id: docRef.id };
}

module.exports = {
  COLLECTION,
  appendStripeWebhookDeadLetter
};
