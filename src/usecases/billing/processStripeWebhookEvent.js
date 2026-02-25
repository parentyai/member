'use strict';

const crypto = require('crypto');

const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const stripeWebhookEventsRepo = require('../../repos/firestore/stripeWebhookEventsRepo');
const stripeWebhookDeadLettersRepo = require('../../repos/firestore/stripeWebhookDeadLettersRepo');
const { createEvent } = require('../../repos/firestore/eventsRepo');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { mapStripeSubscriptionStatus } = require('./mapStripeSubscriptionStatus');
const { handleBillingLifecycleAutomation } = require('./handleBillingLifecycleAutomation');

const SUBSCRIPTION_EVENTS = new Set([
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted'
]);

function hashPayload(rawBody) {
  return crypto.createHash('sha256').update(String(rawBody || ''), 'utf8').digest('hex');
}

function normalizeEventId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveStripeEventCreatedAt(event) {
  const created = event && event.created;
  if (!Number.isFinite(Number(created))) return null;
  return new Date(Number(created) * 1000).toISOString();
}

function resolveLineUserIdFromEvent(event) {
  const object = event && event.data && event.data.object;
  const metadata = object && object.metadata && typeof object.metadata === 'object' ? object.metadata : {};
  const lineUserId = typeof metadata.lineUserId === 'string' ? metadata.lineUserId.trim() : '';
  return lineUserId || null;
}

function resolveSubscriptionPayload(event) {
  const object = event && event.data && event.data.object;
  if (!object || typeof object !== 'object') return null;
  const status = mapStripeSubscriptionStatus(object.status || (event && event.type === 'customer.subscription.deleted' ? 'canceled' : 'unknown'));
  const currentPeriodEnd = Number.isFinite(Number(object.current_period_end))
    ? new Date(Number(object.current_period_end) * 1000).toISOString()
    : null;
  return {
    status,
    currentPeriodEnd,
    stripeCustomerId: typeof object.customer === 'string' ? object.customer : null,
    stripeSubscriptionId: typeof object.id === 'string' ? object.id : null
  };
}

function resolvePlanFromStatus(status) {
  return status === 'active' || status === 'trialing' ? 'pro' : 'free';
}

function toMillis(value) {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

async function moveToDeadLetter(params) {
  const payload = params && typeof params === 'object' ? params : {};
  await stripeWebhookDeadLettersRepo.appendStripeWebhookDeadLetter(payload);
  await stripeWebhookEventsRepo.updateStripeWebhookEvent(payload.eventId, {
    status: 'dead_letter',
    errorCode: payload.errorCode || 'dead_letter',
    userId: payload.userId || null
  });
}

async function appendStripeAudit(action, payload) {
  try {
    await appendAuditLog({
      actor: 'stripe_webhook',
      action,
      entityType: 'billing_subscription',
      entityId: payload && payload.entityId ? payload.entityId : 'stripe_webhook',
      requestId: payload && payload.requestId ? payload.requestId : null,
      payloadSummary: payload && payload.payloadSummary ? payload.payloadSummary : {}
    });
  } catch (_err) {
    // best effort only
  }
}

async function appendJourneyEventBestEffort(data) {
  const payload = data && typeof data === 'object' ? data : {};
  if (!payload.lineUserId || !payload.type) return;
  try {
    await createEvent(Object.assign({}, payload, {
      createdAt: payload.createdAt || new Date().toISOString()
    }));
  } catch (_err) {
    // best effort only
  }
}

async function processStripeWebhookEvent(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const event = payload.event && typeof payload.event === 'object' ? payload.event : null;
  const eventId = normalizeEventId(event && event.id);
  const eventType = typeof event === 'object' && typeof event.type === 'string' ? event.type : '';
  const requestId = typeof payload.requestId === 'string' ? payload.requestId : null;

  if (!event || !eventId) {
    return { ok: false, status: 'invalid', reason: 'event_id_missing' };
  }

  const reserved = await stripeWebhookEventsRepo.reserveStripeWebhookEvent({
    eventId,
    eventType,
    requestId,
    stripeEventCreated: resolveStripeEventCreatedAt(event)
  });
  if (!reserved.created) {
    await appendStripeAudit('webhook_replay', {
      entityId: eventId,
      requestId,
      payloadSummary: {
        eventId,
        eventType,
        status: 'duplicate',
        replay: true
      }
    });
    return { ok: true, status: 'duplicate', eventId };
  }

  if (!SUBSCRIPTION_EVENTS.has(eventType)) {
    await stripeWebhookEventsRepo.updateStripeWebhookEvent(eventId, {
      status: 'ignored'
    });
    return { ok: true, status: 'ignored', eventId };
  }

  const lineUserId = resolveLineUserIdFromEvent(event);
  if (!lineUserId) {
    await moveToDeadLetter({
      eventId,
      errorCode: 'metadata_lineUserId_missing',
      errorMessage: 'metadata.lineUserId required',
      payloadHash: hashPayload(payload.rawBody),
      requestId
    });
    return { ok: true, status: 'dead_letter', eventId, reason: 'metadata_lineUserId_missing' };
  }

  const subscriptionPayload = resolveSubscriptionPayload(event);
  if (!subscriptionPayload) {
    await moveToDeadLetter({
      eventId,
      errorCode: 'subscription_object_missing',
      errorMessage: 'event.data.object missing',
      payloadHash: hashPayload(payload.rawBody),
      requestId,
      userId: lineUserId
    });
    return { ok: true, status: 'dead_letter', eventId, lineUserId, reason: 'subscription_object_missing' };
  }

  try {
    const existing = await userSubscriptionsRepo.getUserSubscription(lineUserId);
    const incomingEventMs = toMillis(resolveStripeEventCreatedAt(event));
    const existingEventMs = existing && existing.lastEventCreatedAt ? toMillis(existing.lastEventCreatedAt) : 0;

    if (existingEventMs && incomingEventMs && incomingEventMs < existingEventMs) {
      await stripeWebhookEventsRepo.updateStripeWebhookEvent(eventId, {
        status: 'stale_ignored',
        userId: lineUserId
      });
      await appendStripeAudit('sub_conflict', {
        entityId: lineUserId,
        requestId,
        payloadSummary: {
          eventId,
          eventType,
          lineUserId,
          reason: 'stale_ignored',
          existingEventMs,
          incomingEventMs
        }
      });
      return { ok: true, status: 'stale_ignored', eventId, lineUserId };
    }

    const status = mapStripeSubscriptionStatus(subscriptionPayload.status);
    const plan = resolvePlanFromStatus(status);
    const wasPro = existing && resolvePlanFromStatus(existing.status) === 'pro';
    const nowPro = plan === 'pro';
    const prevStatus = existing && existing.status ? mapStripeSubscriptionStatus(existing.status) : 'unknown';

    await userSubscriptionsRepo.upsertUserSubscription(lineUserId, {
      plan,
      status,
      currentPeriodEnd: subscriptionPayload.currentPeriodEnd,
      stripeCustomerId: subscriptionPayload.stripeCustomerId,
      stripeSubscriptionId: subscriptionPayload.stripeSubscriptionId,
      lastEventId: eventId,
      lastEventCreatedAt: resolveStripeEventCreatedAt(event)
    });

    await stripeWebhookEventsRepo.updateStripeWebhookEvent(eventId, {
      status: 'processed',
      userId: lineUserId,
      errorCode: null
    });
    if (!wasPro && nowPro) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'pro_converted',
        subscriptionStatus: status,
        eventId,
        eventType
      });
    }
    if (prevStatus !== status && (status === 'past_due' || status === 'canceled' || status === 'incomplete')) {
      await appendJourneyEventBestEffort({
        lineUserId,
        type: 'churn_reason',
        reason: status === 'past_due' ? 'cost' : 'status_change',
        previousStatus: prevStatus,
        nextStatus: status,
        eventId,
        eventType
      });
    }
    await appendStripeAudit('sub_updated', {
      entityId: lineUserId,
      requestId,
      payloadSummary: {
        eventId,
        eventType,
        lineUserId,
        status,
        plan
      }
    });

    let automation = null;
    try {
      automation = await handleBillingLifecycleAutomation({
        lineUserId,
        stripeEventId: eventId,
        prevStatus: existing && existing.status ? existing.status : 'unknown',
        nextStatus: status,
        prevPlan: existing && existing.plan ? existing.plan : resolvePlanFromStatus(existing && existing.status),
        nextPlan: plan
      });
    } catch (_automationErr) {
      automation = {
        ok: false,
        status: 'error',
        reason: 'lifecycle_automation_failed'
      };
    }

    return {
      ok: true,
      status: 'processed',
      eventId,
      lineUserId,
      subscriptionStatus: status,
      plan,
      automation
    };
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'stripe_webhook_process_error';
    await moveToDeadLetter({
      eventId,
      errorCode: 'process_failed',
      errorMessage: message,
      payloadHash: hashPayload(payload.rawBody),
      requestId,
      userId: lineUserId
    });
    return {
      ok: true,
      status: 'dead_letter',
      eventId,
      lineUserId,
      reason: 'process_failed'
    };
  }
}

module.exports = {
  SUBSCRIPTION_EVENTS,
  processStripeWebhookEvent
};
