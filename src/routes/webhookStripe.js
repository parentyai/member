'use strict';

const crypto = require('crypto');
const { processStripeWebhookEvent } = require('../usecases/billing/processStripeWebhookEvent');
const { appendAuditLog } = require('../usecases/audit/appendAuditLog');
const { getPublicWriteSafetySnapshot } = require('../repos/firestore/systemFlagsRepo');

const DEFAULT_TOLERANCE_SEC = 300;
const ROUTE_KEY = 'webhook_stripe';

function resolveStripeWebhookEnabled() {
  const raw = process.env.ENABLE_STRIPE_WEBHOOK;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function resolveTraceId(options, requestId) {
  const payload = options && typeof options === 'object' ? options : {};
  const raw = typeof payload.traceId === 'string' ? payload.traceId.trim() : '';
  if (raw) return raw;
  return requestId;
}

async function appendStripeRouteAuditBestEffort(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  try {
    await appendAuditLog({
      actor: 'stripe_webhook_route',
      action: data.action || 'stripe_webhook.blocked',
      entityType: 'stripe_webhook',
      entityId: data.entityId || 'stripe_webhook',
      traceId: data.traceId || null,
      requestId: data.requestId || null,
      payloadSummary: {
        reason: data.reason || null,
        eventId: data.eventId || null,
        eventType: data.eventType || null,
        failCloseMode: data.failCloseMode || null,
        guardRoute: ROUTE_KEY
      }
    });
  } catch (_err) {
    // best effort only
  }
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
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim()
    ? payload.requestId.trim()
    : `stripe_webhook_${crypto.randomUUID()}`;
  const traceId = resolveTraceId(payload, requestId);

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

  const safety = await getPublicWriteSafetySnapshot(ROUTE_KEY);
  if (safety.readError) {
    if (safety.failCloseMode === 'enforce') {
      await appendStripeRouteAuditBestEffort({
        action: 'stripe_webhook.blocked',
        entityId: event && event.id ? event.id : 'stripe_webhook',
        traceId,
        requestId,
        reason: 'kill_switch_read_failed_fail_closed',
        eventId: event && event.id ? event.id : null,
        eventType: event && event.type ? event.type : null,
        failCloseMode: safety.failCloseMode
      });
      logger(`[stripe_webhook] requestId=${requestId} reject=kill_switch_read_failed_fail_closed`);
      return { status: 503, body: 'temporarily unavailable' };
    }
    if (safety.failCloseMode === 'warn') {
      await appendStripeRouteAuditBestEffort({
        action: 'stripe_webhook.guard_warn',
        entityId: event && event.id ? event.id : 'stripe_webhook',
        traceId,
        requestId,
        reason: 'kill_switch_read_failed_fail_open',
        eventId: event && event.id ? event.id : null,
        eventType: event && event.type ? event.type : null,
        failCloseMode: safety.failCloseMode
      });
    }
  }

  if (safety.killSwitchOn) {
    await appendStripeRouteAuditBestEffort({
      action: 'stripe_webhook.blocked',
      entityId: event && event.id ? event.id : 'stripe_webhook',
      traceId,
      requestId,
      reason: 'kill_switch_on',
      eventId: event && event.id ? event.id : null,
      eventType: event && event.type ? event.type : null
    });
    logger(`[stripe_webhook] requestId=${requestId} reject=kill_switch_on`);
    return { status: 409, body: 'kill switch on' };
  }

  const result = await processStripeWebhookEvent({
    event,
    rawBody,
    requestId,
    traceId
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
