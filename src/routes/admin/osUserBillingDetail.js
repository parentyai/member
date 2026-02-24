'use strict';

const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');
const stripeWebhookEventsRepo = require('../../repos/firestore/stripeWebhookEventsRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
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

    const [subscription, stats, journeyProfile, journeySchedule, journeyStats, journeyTodoItems] = await Promise.all([
      userSubscriptionsRepo.getUserSubscription(lineUserId),
      llmUsageStatsRepo.getUserUsageStats(lineUserId),
      userJourneyProfilesRepo.getUserJourneyProfile(lineUserId).catch(() => null),
      userJourneySchedulesRepo.getUserJourneySchedule(lineUserId).catch(() => null),
      journeyTodoStatsRepo.getUserJourneyTodoStats(lineUserId).catch(() => null),
      journeyTodoItemsRepo.listJourneyTodoItemsByLineUserId({ lineUserId, limit: 5 }).catch(() => [])
    ]);
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
      journey: {
        profile: {
          householdType: journeyProfile && journeyProfile.householdType ? journeyProfile.householdType : null,
          scenarioKeyMirror: journeyProfile && journeyProfile.scenarioKeyMirror ? journeyProfile.scenarioKeyMirror : null,
          timezone: journeyProfile && journeyProfile.timezone ? journeyProfile.timezone : null,
          locale: journeyProfile && journeyProfile.locale ? journeyProfile.locale : null,
          updatedAt: journeyProfile && journeyProfile.updatedAt ? journeyProfile.updatedAt : null
        },
        schedule: {
          departureDate: journeySchedule && journeySchedule.departureDate ? journeySchedule.departureDate : null,
          assignmentDate: journeySchedule && journeySchedule.assignmentDate ? journeySchedule.assignmentDate : null,
          stage: journeySchedule && journeySchedule.stage ? journeySchedule.stage : null,
          updatedAt: journeySchedule && journeySchedule.updatedAt ? journeySchedule.updatedAt : null
        },
        todoStats: {
          openCount: journeyStats && Number.isFinite(Number(journeyStats.openCount)) ? Number(journeyStats.openCount) : 0,
          overdueCount: journeyStats && Number.isFinite(Number(journeyStats.overdueCount)) ? Number(journeyStats.overdueCount) : 0,
          dueIn7DaysCount: journeyStats && Number.isFinite(Number(journeyStats.dueIn7DaysCount)) ? Number(journeyStats.dueIn7DaysCount) : 0,
          nextDueAt: journeyStats && journeyStats.nextDueAt ? journeyStats.nextDueAt : null,
          lastReminderAt: journeyStats && journeyStats.lastReminderAt ? journeyStats.lastReminderAt : null
        },
        nextTodos: Array.isArray(journeyTodoItems) ? journeyTodoItems.slice(0, 5).map((item) => ({
          todoKey: item && item.todoKey ? item.todoKey : null,
          title: item && item.title ? item.title : null,
          dueDate: item && item.dueDate ? item.dueDate : null,
          status: item && item.status ? item.status : null,
          nextReminderAt: item && item.nextReminderAt ? item.nextReminderAt : null
        })) : []
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
