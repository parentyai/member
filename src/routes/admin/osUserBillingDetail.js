'use strict';

const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const llmUsageStatsRepo = require('../../repos/firestore/llmUsageStatsRepo');
const stripeWebhookEventsRepo = require('../../repos/firestore/stripeWebhookEventsRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const userJourneySchedulesRepo = require('../../repos/firestore/userJourneySchedulesRepo');
const journeyTodoStatsRepo = require('../../repos/firestore/journeyTodoStatsRepo');
const journeyTodoItemsRepo = require('../../repos/firestore/journeyTodoItemsRepo');
const { JOURNEY_SCENARIO_MIRROR_FIELD } = require('../../domain/constants');
const { attachOutcome, applyOutcomeHeaders } = require('../../domain/routeOutcomeContract');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

const ROUTE_TYPE = 'admin_route';
const ROUTE_KEY = 'admin.os_user_billing_detail';

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeOutcomeOptions(options) {
  const opts = options && typeof options === 'object' ? options : {};
  const guard = Object.assign({}, opts.guard || {});
  guard.routeKey = ROUTE_KEY;
  const normalized = Object.assign({}, opts, { guard });
  if (!normalized.routeType) normalized.routeType = ROUTE_TYPE;
  return normalized;
}

function writeJson(res, statusCode, payload, outcomeOptions) {
  const body = attachOutcome(payload || {}, normalizeOutcomeOptions(outcomeOptions));
  applyOutcomeHeaders(res, body.outcome);
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
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
      writeJson(res, 400, { ok: false, error: 'lineUserId required', traceId, requestId }, {
        state: 'error',
        reason: 'line_user_id_required'
      });
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

    writeJson(res, 200, {
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
          [JOURNEY_SCENARIO_MIRROR_FIELD]: (
            journeyProfile && journeyProfile[JOURNEY_SCENARIO_MIRROR_FIELD]
              ? journeyProfile[JOURNEY_SCENARIO_MIRROR_FIELD]
              : null
          ),
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
          totalCount: journeyStats && Number.isFinite(Number(journeyStats.totalCount)) ? Number(journeyStats.totalCount) : 0,
          completedCount: journeyStats && Number.isFinite(Number(journeyStats.completedCount)) ? Number(journeyStats.completedCount) : 0,
          lockedCount: journeyStats && Number.isFinite(Number(journeyStats.lockedCount)) ? Number(journeyStats.lockedCount) : 0,
          actionableCount: journeyStats && Number.isFinite(Number(journeyStats.actionableCount)) ? Number(journeyStats.actionableCount) : 0,
          completionRate: journeyStats && Number.isFinite(Number(journeyStats.completionRate)) ? Number(journeyStats.completionRate) : 0,
          dependencyBlockRate: journeyStats && Number.isFinite(Number(journeyStats.dependencyBlockRate)) ? Number(journeyStats.dependencyBlockRate) : 0,
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
    }, {
      state: 'success',
      reason: 'completed'
    });
  } catch (err) {
    logRouteError(ROUTE_KEY, err, { traceId, requestId, actor });
    writeJson(res, 500, { ok: false, error: 'error', traceId, requestId }, {
      state: 'error',
      reason: 'error'
    });
  }
}

module.exports = {
  handleUserBillingDetail
};
