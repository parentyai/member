'use strict';

const { setOpsReview } = require('../../repos/firestore/opsStateRepo');

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
  await setOpsReview({ reviewedBy: payload.reviewedBy, reviewedAt: reviewedAt || undefined });
  return { reviewedBy: payload.reviewedBy };
}

module.exports = {
  recordOpsReview
};
