'use strict';

const STATUS_VALUES = Object.freeze([
  'trialing',
  'active',
  'past_due',
  'canceled',
  'incomplete',
  'unknown'
]);

function mapStripeSubscriptionStatus(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'unknown';
  const normalized = value.trim().toLowerCase();
  if (STATUS_VALUES.includes(normalized)) return normalized;
  if (normalized === 'incomplete_expired') return 'incomplete';
  if (normalized === 'unpaid') return 'past_due';
  return 'unknown';
}

module.exports = {
  STATUS_VALUES,
  mapStripeSubscriptionStatus
};
