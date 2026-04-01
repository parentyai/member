'use strict';

const { analyzeQualityIssues } = require('./analyzeQualityIssues');
const { planImprovements } = require('../../domain/qualityPatrol/planImprovements');

async function planQualityImprovements(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const analyzer = deps && deps.analyzeQualityIssues ? deps.analyzeQualityIssues : analyzeQualityIssues;
  const planner = deps && deps.planImprovements ? deps.planImprovements : planImprovements;

  const rootCauseResult = payload.rootCauseResult
    ? payload.rootCauseResult
    : await analyzer(payload, deps);
  const plan = planner({
    rootCauseResult,
    generatedAt: payload.generatedAt,
    reviewUnits: payload.reviewUnits,
    detectionResult: payload.detectionResult,
    kpiResult: payload.kpiResult
  });
  return Object.assign({
    ok: true,
    rootCauseResult
  }, plan);
}

module.exports = {
  planQualityImprovements
};
