'use strict';

const crypto = require('crypto');
const { ensureUserFromWebhook } = require('../usecases/users/ensureUser');

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyLineSignature(secret, body, signature) {
  if (!secret || !signature) return false;
  const hmac = crypto.createHmac('sha256', secret).update(body).digest('base64');
  const actual = Buffer.from(signature);
  const expected = Buffer.from(hmac);
  return timingSafeEqual(actual, expected);
}

function extractUserIds(payload) {
  const events = Array.isArray(payload && payload.events) ? payload.events : [];
  const ids = new Set();
  for (const event of events) {
    const userId = event && event.source && event.source.userId;
    if (typeof userId === 'string' && userId.length > 0) {
      ids.add(userId);
    }
  }
  return Array.from(ids);
}

async function handleLineWebhook(options) {
  const secret = process.env.LINE_CHANNEL_SECRET || '';
  const signature = options && options.signature;
  const body = options && options.body;
  const logger = (options && options.logger) || (() => {});
  const requestId = (options && options.requestId) || 'unknown';

  if (!secret) {
    logger(`[webhook] requestId=${requestId} reject=missing-secret`);
    return { status: 500, body: 'server misconfigured' };
  }
  if (typeof signature !== 'string' || signature.length === 0) {
    logger(`[webhook] requestId=${requestId} reject=missing-signature`);
    return { status: 401, body: 'unauthorized' };
  }
  if (!verifyLineSignature(secret, body, signature)) {
    logger(`[webhook] requestId=${requestId} reject=invalid-signature`);
    return { status: 401, body: 'unauthorized' };
  }

  let payload;
  try {
    payload = JSON.parse(body || '{}');
  } catch (err) {
    logger(`[webhook] requestId=${requestId} reject=invalid-json`);
    return { status: 400, body: 'invalid json' };
  }

  const userIds = extractUserIds(payload);
  for (const userId of userIds) {
    await ensureUserFromWebhook(userId);
  }

  logger(`[webhook] requestId=${requestId} accept`);
  return { status: 200, body: 'ok', userCount: userIds.length };
}

module.exports = {
  handleLineWebhook,
  verifyLineSignature,
  extractUserIds
};
