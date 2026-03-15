'use strict';

const { buildConversationReviewUnitsFromSources } = require('./buildConversationReviewUnitsFromSources');
const { evaluateConversationReviewUnits } = require('./evaluateConversationReviewUnits');
const { buildPatrolKpis } = require('../../domain/qualityPatrol/buildPatrolKpis');
const {
  buildTranscriptCoverageDiagnostics
} = require('../../domain/qualityPatrol/transcript/buildTranscriptCoverageDiagnostics');
const {
  RECENT_WINDOW_REVIEW_UNIT_COUNT,
  toIso,
  extractWindowTimes,
  deriveRecentWindowFromReviewUnits,
  deriveRecentWindowFromLlmActionLogs,
  derivePreviousWindow,
  buildWindowSnapshot,
  buildDecayAwareReadiness
} = require('../../domain/qualityPatrol/buildDecayAwareReadiness');

function hasWindow(sourceWindow) {
  return Boolean(sourceWindow && sourceWindow.fromAt && sourceWindow.toAt);
}

async function buildPatrolKpisFromEvaluations(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const extractor = deps && deps.buildConversationReviewUnitsFromSources
    ? deps.buildConversationReviewUnitsFromSources
    : buildConversationReviewUnitsFromSources;
  const evaluator = deps && deps.evaluateConversationReviewUnits
    ? deps.evaluateConversationReviewUnits
    : evaluateConversationReviewUnits;
  let reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : null;
  let evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : null;
  let sourceWindow = {
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null
  };
  let sourceCollections = [];
  let llmActionLogs = Array.isArray(payload.llmActionLogs) ? payload.llmActionLogs : null;
  let transcriptCoverage = payload.transcriptCoverage && typeof payload.transcriptCoverage === 'object'
    ? payload.transcriptCoverage
    : null;

  if (!reviewUnits) {
    const extracted = await extractor(payload, deps);
    reviewUnits = Array.isArray(extracted && extracted.reviewUnits) ? extracted.reviewUnits : [];
    sourceWindow = extracted && extracted.sourceWindow ? extracted.sourceWindow : sourceWindow;
    sourceCollections = Array.isArray(extracted && extracted.sourceCollections) ? extracted.sourceCollections.slice() : sourceCollections;
    llmActionLogs = Array.isArray(extracted && extracted.llmActionLogs) ? extracted.llmActionLogs : llmActionLogs;
    transcriptCoverage = extracted && extracted.transcriptCoverage && typeof extracted.transcriptCoverage === 'object'
      ? extracted.transcriptCoverage
      : transcriptCoverage;
  }

  if (!evaluations) {
    const evaluated = await evaluator(Object.assign({}, payload, { reviewUnits }), deps);
    evaluations = Array.isArray(evaluated && evaluated.evaluations) ? evaluated.evaluations : [];
    sourceCollections = sourceCollections.concat(Array.isArray(evaluated && evaluated.sourceCollections) ? evaluated.sourceCollections : []);
  }

  const result = buildPatrolKpis({
    reviewUnits,
    evaluations,
    transcriptCoverage
  });

  async function buildWindowSnapshotForRange(range, overrides) {
    const scopedOverrides = overrides && typeof overrides === 'object' ? overrides : {};
    if (!hasWindow(range)) {
      return buildWindowSnapshot({
        sourceWindow: range,
        reviewUnits: scopedOverrides.reviewUnits,
        transcriptCoverage: scopedOverrides.transcriptCoverage,
        joinDiagnostics: scopedOverrides.joinDiagnostics,
        observationBlockers: scopedOverrides.observationBlockers
      });
    }
    const extracted = await extractor(Object.assign({}, payload, {
      fromAt: range.fromAt,
      toAt: range.toAt
    }), deps);
    const scopedReviewUnits = Array.isArray(extracted && extracted.reviewUnits) ? extracted.reviewUnits : [];
    const scopedEvaluated = await evaluator(Object.assign({}, payload, {
      reviewUnits: scopedReviewUnits,
      fromAt: range.fromAt,
      toAt: range.toAt
    }), deps);
    const scopedEvaluations = Array.isArray(scopedEvaluated && scopedEvaluated.evaluations) ? scopedEvaluated.evaluations : [];
    const scopedKpis = buildPatrolKpis({
      reviewUnits: scopedReviewUnits,
      evaluations: scopedEvaluations,
      transcriptCoverage: scopedOverrides.transcriptCoverage || (extracted && extracted.transcriptCoverage ? extracted.transcriptCoverage : null)
    });
    return buildWindowSnapshot({
      sourceWindow: hasWindow(extractWindowTimes(scopedReviewUnits)) ? extractWindowTimes(scopedReviewUnits) : range,
      reviewUnits: scopedReviewUnits,
      transcriptCoverage: scopedKpis.transcriptCoverage,
      joinDiagnostics: scopedOverrides.joinDiagnostics || (extracted && extracted.joinDiagnostics ? extracted.joinDiagnostics : null),
      observationBlockers: scopedKpis.observationBlockers
    });
  }

  const actualFullWindow = hasWindow(extractWindowTimes(reviewUnits))
    ? extractWindowTimes(reviewUnits)
    : sourceWindow;
  const recentObservedActionLogs = (Array.isArray(llmActionLogs) ? llmActionLogs : [])
    .filter((row) => typeof (row && row.transcriptSnapshotOutcome) === 'string' && row.transcriptSnapshotOutcome.trim())
    .slice()
    .sort((left, right) => {
      const leftAt = toIso(left && left.createdAt);
      const rightAt = toIso(right && right.createdAt);
      const leftMs = leftAt ? new Date(leftAt).getTime() : 0;
      const rightMs = rightAt ? new Date(rightAt).getTime() : 0;
      return rightMs - leftMs;
    })
    .slice(0, payload.recentWindowUnitCount || RECENT_WINDOW_REVIEW_UNIT_COUNT);
  const recentActionLogWindow = deriveRecentWindowFromLlmActionLogs(
    recentObservedActionLogs,
    payload.recentWindowUnitCount || RECENT_WINDOW_REVIEW_UNIT_COUNT
  );
  const recentWindowRange = hasWindow(recentActionLogWindow)
    ? recentActionLogWindow
    : deriveRecentWindowFromReviewUnits(reviewUnits, payload.recentWindowUnitCount || RECENT_WINDOW_REVIEW_UNIT_COUNT);
  const recentWindow = await buildWindowSnapshotForRange(
    recentWindowRange,
    recentObservedActionLogs.length > 0
      ? { transcriptCoverage: buildTranscriptCoverageDiagnostics({ llmActionLogs: recentObservedActionLogs }) }
      : null
  );
  const previousFullWindow = await buildWindowSnapshotForRange(
    derivePreviousWindow(actualFullWindow)
  );
  const fullWindow = buildWindowSnapshot({
    sourceWindow: actualFullWindow,
    reviewUnits,
    transcriptCoverage: result.transcriptCoverage,
    joinDiagnostics: payload.joinDiagnostics || null,
    observationBlockers: result.observationBlockers
  });
  const decayAwareReadiness = buildDecayAwareReadiness({
    recentWindow,
    fullWindow,
    previousFullWindow
  });

  return Object.assign({
    ok: true,
    sourceWindow
  }, result, {
    decayAwareReadiness,
    sourceCollections: Array.from(new Set([].concat(sourceCollections, result.sourceCollections).filter(Boolean)))
  });
}

module.exports = {
  buildPatrolKpisFromEvaluations
};
