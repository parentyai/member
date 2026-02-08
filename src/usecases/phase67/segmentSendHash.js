'use strict';

const crypto = require('crypto');

function normalizeLineUserIds(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => (item && typeof item.lineUserId === 'string' ? item.lineUserId : null))
    .filter((id) => typeof id === 'string');
}

function computePlanHash(templateKey, lineUserIds) {
  const payload = {
    templateKey: templateKey || null,
    lineUserIds: Array.isArray(lineUserIds) ? lineUserIds : []
  };
  const json = JSON.stringify(payload);
  return crypto.createHash('sha256').update(json).digest('hex');
}

module.exports = {
  normalizeLineUserIds,
  computePlanHash
};
