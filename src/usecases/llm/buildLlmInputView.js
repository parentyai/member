'use strict';

const { sanitizeInput } = require('../../llm/allowList');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function collectLeafPaths(value, prefix, out) {
  const current = prefix || '';
  if (Array.isArray(value)) {
    if (current) out.push(current);
    return;
  }
  if (!isPlainObject(value)) {
    if (current) out.push(current);
    return;
  }
  const keys = Object.keys(value);
  if (!keys.length) {
    if (current) out.push(current);
    return;
  }
  for (const key of keys) {
    const next = current ? `${current}.${key}` : key;
    collectLeafPaths(value[key], next, out);
  }
}

function resolveCategory(path, categories) {
  const entries = Object.entries(categories || {}).sort((a, b) => b[0].length - a[0].length);
  for (const [prefix, category] of entries) {
    if (path === prefix || path.startsWith(`${prefix}.`)) return category;
  }
  return 'Internal';
}

function normalizeCategoriesUsed(paths, categories) {
  const used = new Set();
  for (const path of paths) {
    used.add(resolveCategory(path, categories));
  }
  return Array.from(used).sort();
}

function buildLlmInputView(params) {
  const payload = params || {};
  const input = payload.input;
  const allowList = Array.isArray(payload.allowList) ? payload.allowList : [];
  const fieldCategories = isPlainObject(payload.fieldCategories) ? payload.fieldCategories : {};
  const allowRestricted = payload.allowRestricted === true;

  const sanitized = sanitizeInput({ input, allowList });
  if (!sanitized.ok) {
    return {
      ok: false,
      blockedReason: 'allow_list_violation',
      blockedPaths: sanitized.blockedPaths || [],
      inputFieldCategoriesUsed: []
    };
  }

  const leafPaths = [];
  collectLeafPaths(sanitized.data, '', leafPaths);
  const categoriesUsed = normalizeCategoriesUsed(leafPaths, fieldCategories);

  if (categoriesUsed.includes('Secret')) {
    return {
      ok: false,
      blockedReason: 'secret_field_detected',
      blockedPaths: leafPaths,
      inputFieldCategoriesUsed: categoriesUsed
    };
  }
  if (!allowRestricted && categoriesUsed.includes('Restricted')) {
    return {
      ok: false,
      blockedReason: 'restricted_field_detected',
      blockedPaths: leafPaths,
      inputFieldCategoriesUsed: categoriesUsed
    };
  }

  return {
    ok: true,
    data: sanitized.data,
    blockedPaths: [],
    inputFieldCategoriesUsed: categoriesUsed
  };
}

module.exports = {
  buildLlmInputView
};
