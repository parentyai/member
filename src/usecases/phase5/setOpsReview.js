'use strict';

const { setOpsReview } = require('../../repos/firestore/opsStateRepo');
const { normalizeOpsStateRecord } = require('../../domain/normalizers/opsStateNormalizer');

function parseReviewedAt(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date;
  }
  throw new Error('invalid reviewedAt');
}

async function recordOpsReview(params) {
  const payload = params || {};
  if (!payload.reviewedBy || String(payload.reviewedBy).trim().length === 0) {
    throw new Error('reviewedBy required');
  }
  const reviewedAt = parseReviewedAt(payload.reviewedAt);
  const normalized = normalizeOpsStateRecord({
    lastReviewedAt: reviewedAt || undefined,
    lastReviewedBy: payload.reviewedBy
  });
  await setOpsReview({
    reviewedBy: normalized.lastReviewedBy,
    reviewedAt: normalized.lastReviewedAt || undefined
  });
  return { reviewedBy: payload.reviewedBy };
}

module.exports = {
  recordOpsReview
};
