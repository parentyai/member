'use strict';

const crypto = require('crypto');
const { processStripeWebhookEvent } = require('../usecases/billing/processStripeWebhookEvent');

const DEFAULT_TOLERANCE_SEC = 300;

function resolveStripeWebhookEnabled() {
  const raw = process.env.ENABLE_STRIPE_WEBHOOK;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function parseStripeSignatureHeader(value) {
  const raw = typeof value === 'string' ? value : '';
  if (!raw.trim()) return { timestamp: null, signatures: [] };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  let timestamp = null;
  const signatures = [];
  parts.forEach((part) => {
    const [key, val] = part.split('=');
    if (key === 't' && val) {
      const n = Number(val);
      if (Number.isFinite(n)) timestamp = n;
      return;
    }
    if (key === 'v1' && val) {
      signatures.push(val.trim());
    }
  });
  return { timestamp, signatures };
}

function timingSafeHexEqual(left, right) {
  const a = Buffer.from(String(left || ''), 'utf8');
  const b = Buffer.from(String(right || ''), 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function verifyStripeSignature(secret, rawBody, signatureHeader) {
  if (!secret || typeof secret !== 'string' || !secret.trim()) {
    return { ok: false, reason: 'missing_secret' };
  }
  const parsed = parseStripeSignatureHeader(signatureHeader);
  if (!parsed.timestamp || !parsed.signatures.length) {
    return { ok: false, reason: 'missing_signature' };
  }

  const toleranceSec = Number(process.env.STRIPE_WEBHOOK_TOLERANCE_SEC);
  const allowedSkewSec = Number.isFinite(toleranceSec) && toleranceSec > 0
    ? Math.floor(toleranceSec)
    : DEFAULT_TOLERANCE_SEC;
  const nowSec = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSec - parsed.timestamp) > allowedSkewSec) {
    return { ok: false, reason: 'signature_tolerance_exceeded' };
  }

  const signedPayload = `${parsed.timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret.trim()).update(signedPayload, 'utf8').digest('hex');
  const matched = parsed.signatures.some((candidate) => timingSafeHexEqual(candidate, expected));
  return matched ? { ok: true } : { ok: false, reason: 'invalid_signature' };
}

async function handleStripeWebhook(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const logger = typeof payload.logger === 'function' ? payload.logger : () => {};
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : 'unknown';

  if (!resolveStripeWebhookEnabled()) {
    return { status: 404, body: 'not found' };
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
  const rawBody = typeof payload.body === 'string' ? payload.body : '';
  const signatureHeader = typeof payload.signature === 'string' ? payload.signature : '';

  const verify = verifyStripeSignature(secret, rawBody, signatureHeader);
  if (!verify.ok) {
    if (verify.reason === 'missing_secret') {
      logger(`[stripe_webhook] requestId=${requestId} reject=missing_secret`);
      return { status: 500, body: 'server misconfigured' };
    }
    logger(`[stripe_webhook] requestId=${requestId} reject=${verify.reason}`);
    return { status: 401, body: 'unauthorized' };
  }

  let event;
  try {
    event = JSON.parse(rawBody || '{}');
  } catch (_err) {
    logger(`[stripe_webhook] requestId=${requestId} reject=invalid_json`);
    return { status: 400, body: 'invalid json' };
  }

  const result = await processStripeWebhookEvent({
    event,
    rawBody,
    requestId
  });

  logger(`[stripe_webhook] requestId=${requestId} status=${result.status || 'unknown'} eventId=${result.eventId || '-'}`);
  return { status: 200, body: 'ok' };
}

module.exports = {
  parseStripeSignatureHeader,
  verifyStripeSignature,
  handleStripeWebhook,
  resolveStripeWebhookEnabled
};
