'use strict';

const NOTIFICATION_CATEGORIES = Object.freeze([
  'DEADLINE_REQUIRED',
  'IMMEDIATE_ACTION',
  'SEQUENCE_GUIDANCE',
  'TARGETED_ONLY',
  'COMPLETION_CONFIRMATION'
]);

const CATEGORY_SET = new Set(NOTIFICATION_CATEGORIES);

function normalizeNotificationCategory(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') throw new Error('invalid notificationCategory');
  const raw = value.trim();
  if (!raw) return null;
  const normalized = raw.toUpperCase().replace(/[ -]+/g, '_');
  if (!CATEGORY_SET.has(normalized)) throw new Error('invalid notificationCategory');
  return normalized;
}

module.exports = {
  NOTIFICATION_CATEGORIES,
  normalizeNotificationCategory
};
