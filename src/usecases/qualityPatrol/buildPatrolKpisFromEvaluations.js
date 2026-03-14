'use strict';

const { buildConversationReviewUnitsFromSources } = require('./buildConversationReviewUnitsFromSources');
const { evaluateConversationReviewUnits } = require('./evaluateConversationReviewUnits');
const { buildPatrolKpis } = require('../../domain/qualityPatrol/buildPatrolKpis');

async function buildPatrolKpisFromEvaluations(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  let reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : null;
  let evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : null;
  let sourceWindow = {
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null
  };
  let sourceCollections = [];
  let transcriptCoverage = payload.transcriptCoverage && typeof payload.transcriptCoverage === 'object'
    ? payload.transcriptCoverage
    : null;

  if (!reviewUnits) {
    const extractor = deps && deps.buildConversationReviewUnitsFromSources
      ? deps.buildConversationReviewUnitsFromSources
      : buildConversationReviewUnitsFromSources;
    const extracted = await extractor(payload, deps);
    reviewUnits = Array.isArray(extracted && extracted.reviewUnits) ? extracted.reviewUnits : [];
    sourceWindow = extracted && extracted.sourceWindow ? extracted.sourceWindow : sourceWindow;
    sourceCollections = Array.isArray(extracted && extracted.sourceCollections) ? extracted.sourceCollections.slice() : sourceCollections;
    transcriptCoverage = extracted && extracted.transcriptCoverage && typeof extracted.transcriptCoverage === 'object'
      ? extracted.transcriptCoverage
      : transcriptCoverage;
  }

  if (!evaluations) {
    const evaluator = deps && deps.evaluateConversationReviewUnits
      ? deps.evaluateConversationReviewUnits
      : evaluateConversationReviewUnits;
    const evaluated = await evaluator(Object.assign({}, payload, { reviewUnits }), deps);
    evaluations = Array.isArray(evaluated && evaluated.evaluations) ? evaluated.evaluations : [];
    sourceCollections = sourceCollections.concat(Array.isArray(evaluated && evaluated.sourceCollections) ? evaluated.sourceCollections : []);
  }

  const result = buildPatrolKpis({
    reviewUnits,
    evaluations,
    transcriptCoverage
  });
  return Object.assign({
    ok: true,
    sourceWindow
  }, result, {
    sourceCollections: Array.from(new Set([].concat(sourceCollections, result.sourceCollections).filter(Boolean)))
  });
}

module.exports = {
  buildPatrolKpisFromEvaluations
};
