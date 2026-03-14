'use strict';

const { buildPatrolKpisFromEvaluations } = require('./buildPatrolKpisFromEvaluations');
const { detectIssues } = require('../../domain/qualityPatrol/detectIssues');
const { analyzeRootCauses } = require('../../domain/qualityPatrol/analyzeRootCauses');

async function analyzeQualityIssues(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const kpiBuilder = deps && deps.buildPatrolKpisFromEvaluations
    ? deps.buildPatrolKpisFromEvaluations
    : buildPatrolKpisFromEvaluations;
  const detector = deps && deps.detectIssues ? deps.detectIssues : detectIssues;
  const analyzer = deps && deps.analyzeRootCauses ? deps.analyzeRootCauses : analyzeRootCauses;

  const kpiResult = payload.kpiResult
    ? payload.kpiResult
    : (payload.detectionResult ? null : await kpiBuilder(payload, deps));
  const detectionResult = payload.detectionResult
    ? payload.detectionResult
    : detector({ kpiResult });
  const analysis = analyzer({
    detectionResult,
    kpiResult,
    evaluations: payload.evaluations,
    reviewUnits: payload.reviewUnits,
    traceBundles: payload.traceBundles
  });

  return Object.assign({
    ok: true,
    detectionResult,
    kpiResult
  }, analysis);
}

module.exports = {
  analyzeQualityIssues
};
