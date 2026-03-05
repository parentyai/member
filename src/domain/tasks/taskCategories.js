'use strict';

const TASK_CATEGORIES = Object.freeze([
  'IMMIGRATION',
  'HOUSING',
  'BANKING',
  'HEALTHCARE',
  'TRANSPORT',
  'SCHOOL',
  'LIFE_SETUP',
  'COMPANY_ADMIN'
]);

const TASK_CATEGORY_SET = new Set(TASK_CATEGORIES);

function normalizeTaskCategory(value, fallback) {
  if (typeof value !== 'string') return fallback || null;
  const normalized = value.trim().toUpperCase();
  if (!normalized) return fallback || null;
  return TASK_CATEGORY_SET.has(normalized) ? normalized : (fallback || null);
}

module.exports = {
  TASK_CATEGORIES,
  TASK_CATEGORY_SET,
  normalizeTaskCategory
};

