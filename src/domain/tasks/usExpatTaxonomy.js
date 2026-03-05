'use strict';

const TASK_CATEGORY_VALUES = Object.freeze([
  'IMMIGRATION',
  'HOUSING',
  'BANKING',
  'HEALTHCARE',
  'TRANSPORT',
  'SCHOOL',
  'LIFE_SETUP',
  'COMPANY_ADMIN'
]);

const CITY_PACK_MODULE_VALUES = Object.freeze([
  'schools',
  'healthcare',
  'driving',
  'housing',
  'utilities'
]);

function normalizeTaskCategory(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!normalized) return fallback || null;
  if (!TASK_CATEGORY_VALUES.includes(normalized)) return fallback || null;
  return normalized;
}

function normalizeCityPackModule(value, fallback) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return fallback || null;
  if (!CITY_PACK_MODULE_VALUES.includes(normalized)) return fallback || null;
  return normalized;
}

module.exports = {
  TASK_CATEGORY_VALUES,
  CITY_PACK_MODULE_VALUES,
  normalizeTaskCategory,
  normalizeCityPackModule
};
