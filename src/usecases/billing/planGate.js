'use strict';

const userSubscriptionsRepo = require('../../repos/firestore/userSubscriptionsRepo');
const opsConfigRepo = require('../../repos/firestore/opsConfigRepo');
const { mapStripeSubscriptionStatus } = require('./mapStripeSubscriptionStatus');

const PRO_STATUSES = new Set(['active', 'trialing']);

function normalizePlan(value) {
  return String(value || '').trim().toLowerCase() === 'pro' ? 'pro' : 'free';
}

function normalizeStatus(value) {
  return mapStripeSubscriptionStatus(value);
}

function normalizeIntentName(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  if (typeof opsConfigRepo.normalizeIntentToken === 'function') {
    return opsConfigRepo.normalizeIntentToken(raw);
  }
  return raw;
}

function isProEligible(status) {
  return PRO_STATUSES.has(normalizeStatus(status));
}

async function resolvePlan(lineUserId, deps) {
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repo = resolvedDeps.userSubscriptionsRepo || userSubscriptionsRepo;
  const fallback = {
    lineUserId: typeof lineUserId === 'string' ? lineUserId : '',
    plan: 'free',
    status: 'unknown',
    source: 'fallback',
    subscription: null
  };
  if (!lineUserId || typeof lineUserId !== 'string' || !lineUserId.trim()) return fallback;

  try {
    const subscription = await repo.getUserSubscription(lineUserId.trim());
    if (!subscription) {
      return Object.assign({}, fallback, { source: 'missing' });
    }
    const status = normalizeStatus(subscription.status);
    const plan = normalizePlan(subscription.plan) === 'pro' && isProEligible(status) ? 'pro' : 'free';
    return {
      lineUserId: lineUserId.trim(),
      plan,
      status,
      source: 'subscription',
      subscription
    };
  } catch (_err) {
    return fallback;
  }
}

async function resolveAllowedIntent(plan, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const policy = payload.policy || await (payload.opsConfigRepo || opsConfigRepo).getLlmPolicy();
  const normalizedPlan = normalizePlan(plan);
  const free = Array.isArray(policy && policy.allowed_intents_free) ? policy.allowed_intents_free : ['faq_search'];
  const pro = Array.isArray(policy && policy.allowed_intents_pro) ? policy.allowed_intents_pro : ['faq_search'];
  const allowedIntents = normalizedPlan === 'pro' ? pro : free;
  return {
    plan: normalizedPlan,
    allowedIntents: Array.from(new Set(allowedIntents.map((item) => normalizeIntentName(item)).filter(Boolean))),
    policy
  };
}

module.exports = {
  PRO_STATUSES,
  isProEligible,
  normalizeIntentName,
  resolvePlan,
  resolveAllowedIntent
};
