'use strict';

const crypto = require('crypto');

function normalizeLineUserIds(items) {
  if (!Array.isArray(items)) return [];
  const ids = items
    .map((item) => (item && typeof item.lineUserId === 'string' ? item.lineUserId : null))
    .filter((id) => typeof id === 'string');
  return ids.sort();
}

function resolveDateBucket(now) {
  const date = now instanceof Date ? now : new Date();
  return date.toISOString().slice(0, 10);
}

function computePlanHash(templateKey, lineUserIds, bucket) {
  const key = typeof templateKey === 'string' ? templateKey : '';
  const ids = Array.isArray(lineUserIds) ? lineUserIds : [];
  const serverTimeBucket = bucket || resolveDateBucket(new Date());
  const seed = `${key}${ids.join(',')}${serverTimeBucket}`;
  return crypto.createHash('sha256').update(seed).digest('hex');
}

module.exports = {
  normalizeLineUserIds,
  computePlanHash,
  resolveDateBucket
};
