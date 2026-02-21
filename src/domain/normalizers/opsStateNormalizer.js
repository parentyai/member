'use strict';

const READ_ORDER = Object.freeze(['ops_states', 'ops_state']);

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
