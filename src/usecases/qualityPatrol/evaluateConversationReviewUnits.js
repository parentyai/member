'use strict';

const { buildConversationReviewUnitsFromSources } = require('./buildConversationReviewUnitsFromSources');
const { evaluateConversationQuality } = require('../../domain/qualityPatrol/evaluateConversationQuality');

async function evaluateConversationReviewUnits(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  let reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : null;
  let sourceWindow = {
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null
  };
  let sourceCollections = ['review_unit'];

  if (!reviewUnits) {
    const extractor = deps && deps.buildConversationReviewUnitsFromSources
      ? deps.buildConversationReviewUnitsFromSources
      : buildConversationReviewUnitsFromSources;
    const extracted = await extractor(payload, deps);
    reviewUnits = Array.isArray(extracted && extracted.reviewUnits) ? extracted.reviewUnits : [];
    sourceWindow = extracted && extracted.sourceWindow ? extracted.sourceWindow : sourceWindow;
    sourceCollections = Array.isArray(extracted && extracted.sourceCollections)
      ? extracted.sourceCollections.slice()
      : sourceCollections;
  }

  const evaluations = reviewUnits.map((reviewUnit) => evaluateConversationQuality(reviewUnit));
  return {
    ok: true,
    sourceWindow,
    evaluations,
    counts: {
      reviewUnits: reviewUnits.length,
      blocked: evaluations.filter((item) => item && item.status === 'blocked').length,
      fail: evaluations.filter((item) => item && item.status === 'fail').length,
      warn: evaluations.filter((item) => item && item.status === 'warn').length
    },
    sourceCollections
  };
}

module.exports = {
  evaluateConversationReviewUnits
};
