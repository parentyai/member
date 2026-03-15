'use strict';

const { buildConversationReviewUnitsFromSources } = require('./buildConversationReviewUnitsFromSources');
const { evaluateConversationReviewUnits } = require('./evaluateConversationReviewUnits');
const { buildPatrolKpisFromEvaluations } = require('./buildPatrolKpisFromEvaluations');
const { detectIssues } = require('../../domain/qualityPatrol/detectIssues');
const { analyzeQualityIssues } = require('./analyzeQualityIssues');
const { planQualityImprovements } = require('./planQualityImprovements');
const { listOpenIssues } = require('./listOpenIssues');
const { listTopPriorityBacklog } = require('./listTopPriorityBacklog');
const { buildPatrolQueryResponse } = require('../../domain/qualityPatrol/query/buildPatrolQueryResponse');
const { resolveAudienceView } = require('../../domain/qualityPatrol/query/resolveAudienceView');
const {
  buildHumanSafePatrolSurface
} = require('../../domain/qualityPatrol/query/buildHumanSafePatrolSurface');

const QUERY_MODES = new Set([
  'latest',
  'top-risk',
  'newly-detected-improvements',
  'observation-blockers',
  'next-best-pr'
]);

function resolveMode(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return QUERY_MODES.has(normalized) ? normalized : 'latest';
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

async function bestEffort(fn, fallback) {
  try {
    return await fn();
  } catch (_err) {
    return fallback;
  }
}

async function queryLatestPatrolInsights(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const mode = resolveMode(payload.mode);
  const audience = resolveAudienceView(payload.audience);
  const extractor = deps && deps.buildConversationReviewUnitsFromSources
    ? deps.buildConversationReviewUnitsFromSources
    : buildConversationReviewUnitsFromSources;
  const evaluator = deps && deps.evaluateConversationReviewUnits
    ? deps.evaluateConversationReviewUnits
    : evaluateConversationReviewUnits;
  const kpiBuilder = deps && deps.buildPatrolKpisFromEvaluations
    ? deps.buildPatrolKpisFromEvaluations
    : buildPatrolKpisFromEvaluations;
  const analyzerUsecase = deps && deps.analyzeQualityIssues
    ? deps.analyzeQualityIssues
    : analyzeQualityIssues;
  const plannerUsecase = deps && deps.planQualityImprovements
    ? deps.planQualityImprovements
    : planQualityImprovements;
  const issueLister = deps && deps.listOpenIssues ? deps.listOpenIssues : listOpenIssues;
  const backlogLister = deps && deps.listTopPriorityBacklog ? deps.listTopPriorityBacklog : listTopPriorityBacklog;
  const detector = deps && deps.detectIssues ? deps.detectIssues : detectIssues;

  let reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : null;
  let sourceWindow = { fromAt: payload.fromAt || null, toAt: payload.toAt || null };
  let sourceCollections = [];
  let joinDiagnostics = payload.joinDiagnostics && typeof payload.joinDiagnostics === 'object'
    ? payload.joinDiagnostics
    : null;
  let llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : null;

  if (!reviewUnits) {
    const extracted = await extractor(payload, deps);
    reviewUnits = Array.isArray(extracted && extracted.reviewUnits) ? extracted.reviewUnits : [];
    sourceWindow = extracted && extracted.sourceWindow ? extracted.sourceWindow : sourceWindow;
    sourceCollections = uniqueStrings([].concat(sourceCollections, extracted && extracted.sourceCollections));
    joinDiagnostics = extracted && extracted.joinDiagnostics && typeof extracted.joinDiagnostics === 'object'
      ? extracted.joinDiagnostics
      : joinDiagnostics;
    llmActionLogs = Array.isArray(extracted && extracted.llmActionLogs) ? extracted.llmActionLogs : llmActionLogs;
  }

  let evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : null;
  if (!evaluations) {
    const evaluated = await evaluator(Object.assign({}, payload, { reviewUnits }), deps);
    evaluations = Array.isArray(evaluated && evaluated.evaluations) ? evaluated.evaluations : [];
    sourceCollections = uniqueStrings([].concat(sourceCollections, evaluated && evaluated.sourceCollections));
  }

  const kpiResult = payload.kpiResult
    ? payload.kpiResult
    : await kpiBuilder(Object.assign({}, payload, {
      reviewUnits,
      evaluations,
      joinDiagnostics,
      llmActionLogs
    }), deps);
  sourceCollections = uniqueStrings([].concat(sourceCollections, kpiResult && kpiResult.sourceCollections));

  const detectionResult = payload.detectionResult
    ? payload.detectionResult
    : detector({ kpiResult });
  sourceCollections = uniqueStrings([].concat(sourceCollections, detectionResult && detectionResult.sourceCollections));

  const rootCauseResult = payload.rootCauseResult
    ? payload.rootCauseResult
    : await analyzerUsecase(Object.assign({}, payload, {
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult
    }), deps);
  sourceCollections = uniqueStrings([].concat(sourceCollections, rootCauseResult && rootCauseResult.sourceCollections));

  const planResult = payload.planResult
    ? payload.planResult
    : await plannerUsecase(Object.assign({}, payload, {
      reviewUnits,
      evaluations,
      kpiResult,
      detectionResult,
      rootCauseResult
    }), deps);
  sourceCollections = uniqueStrings([].concat(sourceCollections, planResult && planResult.sourceCollections));

  const existingIssues = await bestEffort(() => issueLister({
    limit: payload.registryLimit || 100,
    includeWatching: true
  }, deps), []);
  const existingBacklog = await bestEffort(() => backlogLister({
    limit: payload.backlogLimit || 50
  }, deps), []);

  const response = buildPatrolQueryResponse({
    generatedAt: payload.generatedAt || new Date().toISOString(),
    audience,
    mode,
    reviewUnits,
    evaluations,
    metrics: kpiResult && kpiResult.metrics ? Object.assign({}, kpiResult.metrics, kpiResult.issueCandidateMetrics || {}) : {},
    transcriptCoverage: kpiResult && kpiResult.transcriptCoverage ? kpiResult.transcriptCoverage : null,
    decayAwareReadiness: kpiResult && kpiResult.decayAwareReadiness ? kpiResult.decayAwareReadiness : null,
    decayAwareOpsGate: kpiResult && kpiResult.decayAwareOpsGate ? kpiResult.decayAwareOpsGate : null,
    kpiSummary: kpiResult && kpiResult.summary ? kpiResult.summary : null,
    issues: detectionResult && Array.isArray(detectionResult.issueCandidates) ? detectionResult.issueCandidates : [],
    rootCauseReports: rootCauseResult && Array.isArray(rootCauseResult.rootCauseReports) ? rootCauseResult.rootCauseReports : [],
    recommendedPr: planResult && Array.isArray(planResult.recommendedPr) ? planResult.recommendedPr : [],
    planObservationBlockers: planResult && Array.isArray(planResult.observationBlockers) ? planResult.observationBlockers : [],
    planningStatus: planResult && planResult.planningStatus ? planResult.planningStatus : 'insufficient_evidence',
    joinDiagnostics,
    existingIssues,
    existingBacklog,
    sourceCollections
  });

  const humanSurface = audience === 'human'
    ? buildHumanSafePatrolSurface({
      transcriptCoverage: kpiResult && kpiResult.transcriptCoverage ? kpiResult.transcriptCoverage : null,
      decayAwareReadiness: kpiResult && kpiResult.decayAwareReadiness ? kpiResult.decayAwareReadiness : null,
      decayAwareOpsGate: kpiResult && kpiResult.decayAwareOpsGate ? kpiResult.decayAwareOpsGate : null,
      rootCauseResult,
      planResult,
      backlogSeparation: response.backlogSeparation
    })
    : null;

  return Object.assign({
    ok: true,
    mode,
    audience,
    sourceWindow,
    reviewUnitCount: reviewUnits.length,
    existingIssueCount: Array.isArray(existingIssues) ? existingIssues.length : 0,
    existingBacklogCount: Array.isArray(existingBacklog) ? existingBacklog.length : 0,
    rootCauseResult: humanSurface ? humanSurface.rootCauseResult : rootCauseResult,
    planResult: humanSurface ? humanSurface.planResult : planResult
  }, response);
}

module.exports = {
  queryLatestPatrolInsights
};
