'use strict';

const { mapStripeSubscriptionStatus } = require('./mapStripeSubscriptionStatus');
const { pushMessage } = require('../../infra/lineClient');
const journeyPolicyRepo = require('../../repos/firestore/journeyPolicyRepo');
const billingLifecycleAutomationLogsRepo = require('../../repos/firestore/billingLifecycleAutomationLogsRepo');
const userJourneyProfilesRepo = require('../../repos/firestore/userJourneyProfilesRepo');
const { syncJourneyTodoPlan } = require('../journey/syncJourneyTodoPlan');
const { applyPersonalizedRichMenu } = require('../journey/applyPersonalizedRichMenu');

function normalizeLineUserId(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolvePlanFromStatus(status) {
  const normalized = mapStripeSubscriptionStatus(status);
  return normalized === 'active' || normalized === 'trialing' ? 'pro' : 'free';
}

function resolveLifecycleAutomationEnabled() {
  const raw = process.env.ENABLE_BILLING_LIFECYCLE_AUTOMATION;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

async function maybeSendLifecycleMessage(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const policyRepo = resolvedDeps.journeyPolicyRepo || journeyPolicyRepo;
  const pushFn = resolvedDeps.pushMessage || pushMessage;
  const policy = payload.journeyPolicy || await policyRepo.getJourneyPolicy();

  if (payload.prevPlan === payload.nextPlan) return null;
  if (payload.nextPlan === 'pro' && policy.auto_upgrade_message_enabled === true) {
    await pushFn(payload.lineUserId, {
      type: 'text',
      text: 'Proプランが有効になりました。\nリッチメニューとTODOガイドを最新状態に更新しました。'
    });
    return 'upgrade_message_sent';
  }
  if (payload.nextPlan === 'free' && policy.auto_downgrade_message_enabled === true) {
    await pushFn(payload.lineUserId, {
      type: 'text',
      text: '課金状態の変更によりFreeモードへ切り替わりました。\nFAQ検索は引き続き利用できます。'
    });
    return 'downgrade_message_sent';
  }
  return null;
}

async function handleBillingLifecycleAutomation(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const logsRepo = resolvedDeps.billingLifecycleAutomationLogsRepo || billingLifecycleAutomationLogsRepo;
  const profileRepo = resolvedDeps.userJourneyProfilesRepo || userJourneyProfilesRepo;
  const syncJourneyTodoPlanFn = resolvedDeps.syncJourneyTodoPlan || syncJourneyTodoPlan;
  const applyPersonalizedRichMenuFn = resolvedDeps.applyPersonalizedRichMenu || applyPersonalizedRichMenu;

  const lineUserId = normalizeLineUserId(payload.lineUserId);
  if (!lineUserId) {
    return { ok: false, status: 'invalid', reason: 'lineUserId required' };
  }

  const prevStatus = mapStripeSubscriptionStatus(payload.prevStatus || (payload.prevSubscription && payload.prevSubscription.status));
  const nextStatus = mapStripeSubscriptionStatus(payload.nextStatus || (payload.nextSubscription && payload.nextSubscription.status));
  const prevPlan = payload.prevPlan === 'pro' || payload.prevPlan === 'free'
    ? payload.prevPlan
    : resolvePlanFromStatus(prevStatus);
  const nextPlan = payload.nextPlan === 'pro' || payload.nextPlan === 'free'
    ? payload.nextPlan
    : resolvePlanFromStatus(nextStatus);

  const transition = `${prevPlan}:${prevStatus}->${nextPlan}:${nextStatus}`;
  const baseLog = {
    lineUserId,
    stripeEventId: payload.stripeEventId || null,
    prevStatus,
    nextStatus,
    transition
  };

  if (!resolveLifecycleAutomationEnabled()) {
    await logsRepo.appendBillingLifecycleAutomationLog(Object.assign({}, baseLog, {
      actionsApplied: [],
      decision: 'disabled_by_env',
      error: null
    }));
    return {
      ok: true,
      status: 'disabled_by_env',
      prevStatus,
      nextStatus,
      prevPlan,
      nextPlan,
      transition,
      actionsApplied: []
    };
  }

  const actionsApplied = [];

  try {
    const profile = await profileRepo.getUserJourneyProfile(lineUserId);

    const syncResult = await syncJourneyTodoPlanFn({
      lineUserId,
      profile,
      source: 'billing_lifecycle_automation'
    }, resolvedDeps);
    actionsApplied.push(`todo_sync:${syncResult.syncedCount}`);

    const richMenuResult = await applyPersonalizedRichMenuFn({
      lineUserId,
      plan: nextPlan,
      householdType: profile && profile.householdType ? profile.householdType : null,
      source: 'billing_lifecycle_automation'
    }, resolvedDeps);
    actionsApplied.push(`rich_menu:${richMenuResult.status}`);

    const lifecycleMessage = await maybeSendLifecycleMessage({
      lineUserId,
      prevPlan,
      nextPlan
    }, resolvedDeps);
    if (lifecycleMessage) actionsApplied.push(lifecycleMessage);

    await logsRepo.appendBillingLifecycleAutomationLog(Object.assign({}, baseLog, {
      actionsApplied,
      decision: 'applied',
      error: null
    }));

    return {
      ok: true,
      status: 'applied',
      prevStatus,
      nextStatus,
      prevPlan,
      nextPlan,
      transition,
      actionsApplied
    };
  } catch (err) {
    const message = err && err.message ? String(err.message) : 'lifecycle_automation_failed';
    await logsRepo.appendBillingLifecycleAutomationLog(Object.assign({}, baseLog, {
      actionsApplied,
      decision: 'error',
      error: message
    }));
    return {
      ok: false,
      status: 'error',
      prevStatus,
      nextStatus,
      prevPlan,
      nextPlan,
      transition,
      actionsApplied,
      reason: message
    };
  }
}

module.exports = {
  handleBillingLifecycleAutomation
};
