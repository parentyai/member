'use strict';

const {
  OPS_STATE_CANONICAL_COLLECTION,
  OPS_STATE_LEGACY_COLLECTION
} = require('../canonicalAuthority');

const READ_ORDER = Object.freeze([OPS_STATE_CANONICAL_COLLECTION, OPS_STATE_LEGACY_COLLECTION]);

function resolveOpsStateReadOrder() {
  return READ_ORDER.slice();
}

function normalizeOpsStateRecord(record) {
  const payload = record && typeof record === 'object' ? record : {};
  return {
    lastReviewedAt: payload.lastReviewedAt || null,
    lastReviewedBy: payload.lastReviewedBy || null
  };
}

module.exports = {
  resolveOpsStateReadOrder,
  normalizeOpsStateRecord
};
