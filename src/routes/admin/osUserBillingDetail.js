'use strict';

const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');
const stripeWebhookEventsRepo = require('../../repos/firestore/stripeWebhookEventsRepo');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

async function handleUserBillingDetail(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;
  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const lineUserId = normalizeLineUserId(url.searchParams.get('lineUserId'));
    if (!lineUserId) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: 'lineUserId required', traceId, requestId }));
      return;
    }

    const subscription = await userSubscriptionsRepo.getUserSubscription(lineUserId);
    const stats = await llmUsageStatsRepo.getUserUsageStats(lineUserId);
    const lastEventId = subscription && subscription.lastEventId ? subscription.lastEventId : null;
    const lastStripeEvent = lastEventId ? await stripeWebhookEventsRepo.getStripeWebhookEvent(lastEventId) : null;

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      lineUserId,
      billing: {
        plan: subscription && subscription.plan ? subscription.plan : 'free',
        status: subscription && subscription.status ? subscription.status : 'unknown',
        currentPeriodEnd: subscription && subscription.currentPeriodEnd ? subscription.currentPeriodEnd : null,
        updatedAt: subscription && subscription.updatedAt ? subscription.updatedAt : null,
        stripeCustomerId: subscription && subscription.stripeCustomerId ? subscription.stripeCustomerId : null,
        stripeSubscriptionId: subscription && subscription.stripeSubscriptionId ? subscription.stripeSubscriptionId : null,
        lastEventId
      },
      llmUsage: {
        usageCount: stats.usageCount,
        totalTokensIn: stats.totalTokensIn,
        totalTokensOut: stats.totalTokensOut,
        totalTokenUsed: stats.totalTokenUsed,
        blockedCount: stats.blockedCount,
        lastUsedAt: stats.lastUsedAt,
        blockedHistory: stats.blockedHistory
      },
      lastStripeEvent
    }));
  } catch (err) {
    logRouteError('admin.os_user_billing_detail', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleUserBillingDetail
};
