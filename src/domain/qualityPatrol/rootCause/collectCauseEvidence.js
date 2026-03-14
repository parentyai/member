'use strict';

function mergeStrings() {
  const out = [];
  Array.from(arguments).forEach((input) => {
    (Array.isArray(input) ? input : []).forEach((item) => {
      if (typeof item === 'string' && item.trim()) out.push(item.trim());
    });
  });
  return Array.from(new Set(out)).sort((left, right) => left.localeCompare(right, 'ja'));
}

function metricEnvelopeFor(issue, kpiResult) {
  if (!issue || !kpiResult || typeof kpiResult !== 'object') return null;
  if (kpiResult.metrics && kpiResult.metrics[issue.metricKey]) return kpiResult.metrics[issue.metricKey];
  if (kpiResult.issueCandidateMetrics && kpiResult.issueCandidateMetrics[issue.metricKey]) {
    return kpiResult.issueCandidateMetrics[issue.metricKey];
  }
  return null;
}

function metricSliceRow(envelope, slice) {
  if (!envelope || typeof envelope !== 'object') return null;
  if (!slice || slice === 'global') return envelope;
  const rows = Array.isArray(envelope.bySlice) ? envelope.bySlice : [];
  return rows.find((row) => row && row.slice === slice) || null;
}

function matchesSlice(issueSlice, rowSlice) {
  if (!issueSlice || issueSlice === 'global') return true;
  return rowSlice === issueSlice;
}

function normalizeTraceBundles(traceBundles) {
  if (Array.isArray(traceBundles)) return traceBundles.filter((item) => item && typeof item === 'object');
  if (traceBundles && Array.isArray(traceBundles.bundles)) return traceBundles.bundles.filter((item) => item && typeof item === 'object');
  return [];
}

function appendEvidence(target, item) {
  if (!item || typeof item !== 'object') return;
  const normalized = {};
  if (item.source) normalized.source = String(item.source);
  if (item.traceId) normalized.traceId = String(item.traceId);
  if (item.reviewUnitId) normalized.reviewUnitId = String(item.reviewUnitId);
  if (item.signal) normalized.signal = String(item.signal);
  if (item.summary) normalized.summary = String(item.summary);
  if (item.value !== undefined) normalized.value = item.value;
  if (item.metric !== undefined) normalized.metric = item.metric;
  if (item.status !== undefined) normalized.status = item.status;
  if (item.slice !== undefined) normalized.slice = item.slice;
  if (!Object.keys(normalized).length) return;
  const key = JSON.stringify(normalized);
  if (target.seen.has(key)) return;
  target.seen.add(key);
  target.rows.push(normalized);
}

function collectCauseEvidence(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const issue = payload.issue && typeof payload.issue === 'object' ? payload.issue : {};
  const kpiResult = payload.kpiResult && typeof payload.kpiResult === 'object' ? payload.kpiResult : {};
  const evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : [];
  const reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : [];
  const traceBundles = normalizeTraceBundles(payload.traceBundles);
  const issueSlice = issue.slice || 'global';
  const metricEnvelope = metricEnvelopeFor(issue, kpiResult);
  const scopedMetric = metricSliceRow(metricEnvelope, issueSlice);
  const matchingEvaluations = evaluations.filter((row) => matchesSlice(issueSlice, row && row.slice));
  const matchingReviewUnits = reviewUnits.filter((row) => matchesSlice(issueSlice, row && row.slice));
  const traceIds = new Set();
  matchingReviewUnits.forEach((unit) => {
    (Array.isArray(unit && unit.evidenceRefs) ? unit.evidenceRefs : []).forEach((ref) => {
      if (ref && typeof ref.traceId === 'string' && ref.traceId.trim()) traceIds.add(ref.traceId.trim());
    });
  });
  const matchingTraceBundles = traceBundles.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    if (traceIds.size === 0) return false;
    return typeof row.traceId === 'string' && traceIds.has(row.traceId);
  });

  const observationBlockers = [];
  const blockerSeen = new Set();
  function appendBlockers(items) {
    (Array.isArray(items) ? items : []).forEach((item) => {
      if (!item || typeof item !== 'object' || !item.code) return;
      const key = JSON.stringify([item.code, item.source || '', item.message || '']);
      if (blockerSeen.has(key)) return;
      blockerSeen.add(key);
      observationBlockers.push({
        code: item.code,
        severity: item.severity || 'medium',
        message: item.message || null,
        source: item.source || null
      });
    });
  }
  appendBlockers(issue.observationBlockers);
  appendBlockers(scopedMetric && scopedMetric.observationBlockers);
  matchingReviewUnits.forEach((unit) => appendBlockers(unit && unit.observationBlockers));

  const runtimeSignals = {
    retrievalBlockedByStrategy: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.retrievalBlockedByStrategy === true),
    retrievalPermitReasons: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.retrievalPermitReason)),
    selectedCandidateKinds: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.selectedCandidateKind)),
    fallbackTemplateKinds: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.fallbackTemplateKind)),
    finalizerTemplateKinds: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.finalizerTemplateKind)),
    readinessDecisions: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.readinessDecision)),
    knowledgeGroundingKinds: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.knowledgeGroundingKind)),
    replyTemplateFingerprints: mergeStrings(matchingReviewUnits.map((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.replyTemplateFingerprint)),
    groundedCandidateAvailable: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.groundedCandidateAvailable === true),
    cityPackCandidateAvailable: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.cityPackCandidateAvailable === true),
    savedFaqCandidateAvailable: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.savedFaqCandidateAvailable === true),
    knowledgeCandidateUsed: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.knowledgeCandidateUsed === true),
    cityPackUsedInAnswer: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.cityPackUsedInAnswer === true),
    savedFaqUsedInAnswer: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.savedFaqUsedInAnswer === true),
    priorContextUsed: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.priorContextUsed === true),
    followupResolvedFromHistory: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && unit.telemetrySignals.followupResolvedFromHistory === true),
    repeatRiskHigh: matchingReviewUnits.some((unit) => unit && unit.telemetrySignals && Number(unit.telemetrySignals.repeatRiskScore) >= 0.6),
    committedNextActions: mergeStrings(matchingReviewUnits.flatMap((unit) => unit && unit.telemetrySignals && Array.isArray(unit.telemetrySignals.committedNextActions)
      ? unit.telemetrySignals.committedNextActions
      : []))
  };

  const traceSummary = {
    retrievalBlockReasons: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.retrievalBlockReasons) ? row.summary.retrievalBlockReasons : [])),
    retrievalPermitReasons: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.retrievalPermitReasons) ? row.summary.retrievalPermitReasons : [])),
    knowledgeRejectedReasons: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.knowledgeRejectedReasons) ? row.summary.knowledgeRejectedReasons : [])),
    cityPackRejectedReasons: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.cityPackRejectedReasons) ? row.summary.cityPackRejectedReasons : [])),
    savedFaqRejectedReasons: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.savedFaqRejectedReasons) ? row.summary.savedFaqRejectedReasons : [])),
    sourceReadinessDecisionSources: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.sourceReadinessDecisionSources) ? row.summary.sourceReadinessDecisionSources : [])),
    fallbackTemplateKinds: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.fallbackTemplateKinds) ? row.summary.fallbackTemplateKinds : [])),
    finalizerTemplateKinds: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.finalizerTemplateKinds) ? row.summary.finalizerTemplateKinds : [])),
    replyTemplateFingerprints: mergeStrings(matchingTraceBundles.flatMap((row) => row && row.summary && Array.isArray(row.summary.replyTemplateFingerprints) ? row.summary.replyTemplateFingerprints : []))
  };

  const evidence = { rows: [], seen: new Set() };
  (Array.isArray(issue.supportingEvidence) ? issue.supportingEvidence : []).forEach((item) => appendEvidence(evidence, Object.assign({ source: 'detection' }, item)));
  if (scopedMetric) {
    appendEvidence(evidence, {
      source: 'kpi',
      metric: issue.metricKey,
      status: scopedMetric.status,
      value: scopedMetric.value,
      slice: issueSlice,
      summary: `sample:${scopedMetric.sampleCount || 0}`
    });
  }
  matchingReviewUnits.slice(0, 4).forEach((unit) => {
    const telemetry = unit && unit.telemetrySignals ? unit.telemetrySignals : {};
    appendEvidence(evidence, {
      source: 'review_unit',
      reviewUnitId: unit && unit.reviewUnitId,
      signal: 'selectedCandidateKind',
      value: telemetry.selectedCandidateKind || null,
      slice: unit && unit.slice,
      summary: telemetry.strategyReason || null
    });
    appendEvidence(evidence, {
      source: 'review_unit',
      reviewUnitId: unit && unit.reviewUnitId,
      signal: 'readinessDecision',
      value: telemetry.readinessDecision || null,
      slice: unit && unit.slice,
      summary: telemetry.finalizerTemplateKind || null
    });
  });
  matchingTraceBundles.slice(0, 2).forEach((bundle) => appendEvidence(evidence, {
    source: 'trace_bundle',
    traceId: bundle && bundle.traceId,
    signal: 'trace_join_summary',
    summary: bundle && bundle.traceJoinSummary
      ? `completeness:${bundle.traceJoinSummary.completeness || 0}`
      : null
  }));

  const sourceCollections = mergeStrings(
    issue.sourceCollections,
    metricEnvelope && metricEnvelope.sourceCollections,
    matchingEvaluations.flatMap((row) => Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []),
    matchingReviewUnits.flatMap((row) => Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []),
    matchingTraceBundles.flatMap(() => ['trace_bundle'])
  );

  const evidenceGaps = [];
  if (!metricEnvelope) evidenceGaps.push('missing_metric_envelope');
  if (!matchingEvaluations.length) evidenceGaps.push('missing_evaluation_rows');
  if (!matchingReviewUnits.length) evidenceGaps.push('missing_review_units');
  if (traceIds.size > 0 && !matchingTraceBundles.length) evidenceGaps.push('missing_trace_bundles');

  return {
    issue,
    metricEnvelope,
    scopedMetric,
    matchingEvaluations,
    matchingReviewUnits,
    matchingTraceBundles,
    observationBlockers,
    runtimeSignals,
    traceSummary,
    sourceCollections,
    supportingEvidence: evidence.rows,
    evidenceGaps
  };
}

module.exports = {
  collectCauseEvidence
};
