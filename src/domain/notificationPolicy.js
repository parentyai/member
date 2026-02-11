'use strict';

const { normalizeNotificationCategory } = require('./notificationCategory');

const MATRIX = Object.freeze({
  1: Object.freeze({
    A: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION']),
    B: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE']),
    C: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'TARGETED_ONLY'])
  }),
  2: Object.freeze({
    A: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE']),
    B: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY']),
    C: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION'])
  }),
  3: Object.freeze({
    A: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY']),
    B: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION']),
    C: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION'])
  }),
  4: Object.freeze({
    A: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION']),
    B: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION']),
    C: Object.freeze(['DEADLINE_REQUIRED', 'IMMEDIATE_ACTION', 'SEQUENCE_GUIDANCE', 'TARGETED_ONLY', 'COMPLETION_CONFIRMATION'])
  })
});

function normalizeServicePhase(value) {
  if (value === null || value === undefined) return null;
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < 1 || num > 4) return null;
  return num;
}

function normalizeNotificationPreset(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return null;
  const upper = value.trim().toUpperCase();
  if (upper === 'A' || upper === 'B' || upper === 'C') return upper;
  return null;
}

function resolveAllowedCategories(servicePhase, notificationPreset) {
  const phase = normalizeServicePhase(servicePhase);
  const preset = normalizeNotificationPreset(notificationPreset);
  if (phase === null || preset === null) return null;
  const byPhase = MATRIX[phase];
  if (!byPhase) return null;
  const allowed = byPhase[preset];
  if (!allowed) return null;
  return Array.from(allowed);
}

function evaluateNotificationPolicy(params) {
  const payload = params || {};
  const servicePhase = normalizeServicePhase(payload.servicePhase);
  const notificationPreset = normalizeNotificationPreset(payload.notificationPreset);
  const allowedCategories = resolveAllowedCategories(servicePhase, notificationPreset);

  if (servicePhase === null || notificationPreset === null || !allowedCategories) {
    return {
      enforced: false,
      allowed: true,
      reason: 'policy_not_configured',
      servicePhase,
      notificationPreset,
      notificationCategory: null,
      allowedCategories: null
    };
  }

  let notificationCategory = null;
  try {
    notificationCategory = normalizeNotificationCategory(payload.notificationCategory);
  } catch (_err) {
    return {
      enforced: true,
      allowed: false,
      reason: 'invalid_notification_category',
      servicePhase,
      notificationPreset,
      notificationCategory: null,
      allowedCategories
    };
  }

  if (!notificationCategory) {
    return {
      enforced: true,
      allowed: false,
      reason: 'notification_category_required',
      servicePhase,
      notificationPreset,
      notificationCategory: null,
      allowedCategories
    };
  }

  if (!allowedCategories.includes(notificationCategory)) {
    return {
      enforced: true,
      allowed: false,
      reason: 'notification_category_not_allowed',
      servicePhase,
      notificationPreset,
      notificationCategory,
      allowedCategories
    };
  }

  return {
    enforced: true,
    allowed: true,
    reason: 'allowed',
    servicePhase,
    notificationPreset,
    notificationCategory,
    allowedCategories
  };
}

function resolveNotificationCategoryFromTemplate(template) {
  if (!template || typeof template !== 'object') return null;
  const content = template.content && typeof template.content === 'object' ? template.content : null;
  if (content && content.notificationCategory !== undefined) return content.notificationCategory;
  if (template.notificationCategory !== undefined) return template.notificationCategory;
  return null;
}

module.exports = {
  evaluateNotificationPolicy,
  resolveAllowedCategories,
  resolveNotificationCategoryFromTemplate
};
