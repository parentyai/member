'use strict';

const { KPI_THRESHOLDS, KPI_PROVENANCE } = require('./kpi/constants');
const { groupBySlice } = require('./kpi/groupBySlice');
const { mergeObservationBlockers } = require('./kpi/mergeObservationBlockers');
const { resolveMetricStatus } = require('./kpi/resolveMetricStatus');
const { buildMetricEnvelope } = require('./kpi/buildMetricEnvelope');
const { aggregateSignalMetric } = require('./kpi/aggregateSignalMetric');
const { aggregateIssueCandidateMetric } = require('./kpi/aggregateIssueCandidateMetric');
const {
  createEmptyTranscriptCoverageDiagnostics,
  buildTranscriptCoverageDiagnostics
} = require('./transcript/buildTranscriptCoverageDiagnostics');

function normalizeSliceCounts(rows) {
  const grouped = groupBySlice(rows, (row) => row && row.slice);
  const result = {};
  grouped.forEach((sliceRows, slice) => {
    result[slice] = sliceRows.length;
  });
  return result;
}

function mergeSourceCollections() {
  return Array.from(new Set([].concat(...Array.from(arguments)).filter(Boolean))).sort((left, right) => left.localeCompare(right, 'ja'));
}

function normalizeTranscriptCoverage(reviewUnits, input) {
  const defaultDiagnostics = createEmptyTranscriptCoverageDiagnostics();
  const diagnostics = input && typeof input === 'object'
    ? Object.assign({}, defaultDiagnostics, input)
    : defaultDiagnostics;
  if ((!diagnostics || Number(diagnostics.observedCount || 0) <= 0) && Array.isArray(reviewUnits) && reviewUnits.length > 0) {
    return buildTranscriptCoverageDiagnostics({
      llmActionLogs: reviewUnits
        .map((unit) => ({
          transcriptSnapshotOutcome: unit && unit.telemetrySignals && unit.telemetrySignals.transcriptSnapshotOutcome,
          transcriptSnapshotReason: unit && unit.telemetrySignals && unit.telemetrySignals.transcriptSnapshotReason
        }))
    });
  }
  return {
    observedCount: Number(diagnostics.observedCount || 0),
    writtenCount: Number(diagnostics.writtenCount || 0),
    skippedCount: Number(diagnostics.skippedCount || 0),
    failedCount: Number(diagnostics.failedCount || 0),
    transcriptWriteOutcomeCounts: Object.assign(
      {},
      createEmptyTranscriptCoverageDiagnostics().transcriptWriteOutcomeCounts,
      diagnostics.transcriptWriteOutcomeCounts || {}
    ),
    transcriptWriteFailureReasons: diagnostics.transcriptWriteFailureReasons && typeof diagnostics.transcriptWriteFailureReasons === 'object'
      ? Object.fromEntries(
        Object.entries(diagnostics.transcriptWriteFailureReasons)
          .filter((entry) => Number(entry[1]) > 0)
          .sort((left, right) => left[0].localeCompare(right[0], 'ja'))
      )
      : {},
    snapshotInputDiagnostics: diagnostics.snapshotInputDiagnostics && typeof diagnostics.snapshotInputDiagnostics === 'object'
      ? Object.assign({}, defaultDiagnostics.snapshotInputDiagnostics, diagnostics.snapshotInputDiagnostics, {
        assistant_reply_missing: Number.isFinite(Number(diagnostics.snapshotInputDiagnostics.assistant_reply_missing))
          ? Math.max(0, Math.floor(Number(diagnostics.snapshotInputDiagnostics.assistant_reply_missing)))
          : defaultDiagnostics.snapshotInputDiagnostics.assistant_reply_missing,
        sanitized_reply_empty: Number.isFinite(Number(diagnostics.snapshotInputDiagnostics.sanitized_reply_empty))
          ? Math.max(0, Math.floor(Number(diagnostics.snapshotInputDiagnostics.sanitized_reply_empty)))
          : defaultDiagnostics.snapshotInputDiagnostics.sanitized_reply_empty,
        masking_removed_text: Number.isFinite(Number(diagnostics.snapshotInputDiagnostics.masking_removed_text))
          ? Math.max(0, Math.floor(Number(diagnostics.snapshotInputDiagnostics.masking_removed_text)))
          : defaultDiagnostics.snapshotInputDiagnostics.masking_removed_text,
        region_prompt_fallback: Number.isFinite(Number(diagnostics.snapshotInputDiagnostics.region_prompt_fallback))
          ? Math.max(0, Math.floor(Number(diagnostics.snapshotInputDiagnostics.region_prompt_fallback)))
          : defaultDiagnostics.snapshotInputDiagnostics.region_prompt_fallback,
        assistantReplyPresent: Object.assign(
          {},
          defaultDiagnostics.snapshotInputDiagnostics.assistantReplyPresent,
          diagnostics.snapshotInputDiagnostics.assistantReplyPresent || {}
        ),
        assistantReplyLength: Object.assign(
          {},
          defaultDiagnostics.snapshotInputDiagnostics.assistantReplyLength,
          diagnostics.snapshotInputDiagnostics.assistantReplyLength || {}
        ),
        sanitizedReplyLength: Object.assign(
          {},
          defaultDiagnostics.snapshotInputDiagnostics.sanitizedReplyLength,
          diagnostics.snapshotInputDiagnostics.sanitizedReplyLength || {}
        ),
        snapshotBuildAttempted: Object.assign(
          {},
          defaultDiagnostics.snapshotInputDiagnostics.snapshotBuildAttempted,
          diagnostics.snapshotInputDiagnostics.snapshotBuildAttempted || {}
        ),
        snapshotBuildSkippedReason: Object.assign(
          {},
          defaultDiagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason,
          diagnostics.snapshotInputDiagnostics.snapshotBuildSkippedReason || {}
        )
      })
      : defaultDiagnostics.snapshotInputDiagnostics,
    transcriptCoverageStatus: typeof diagnostics.transcriptCoverageStatus === 'string'
      ? diagnostics.transcriptCoverageStatus
      : 'unavailable',
    sourceCollections: mergeSourceCollections(diagnostics.sourceCollections || ['llm_action_logs'])
  };
}

function reviewUnitNeedsPriorContext(reviewUnit) {
  const unit = reviewUnit && typeof reviewUnit === 'object' ? reviewUnit : {};
  const telemetry = unit.telemetrySignals && typeof unit.telemetrySignals === 'object' ? unit.telemetrySignals : {};
  return unit.slice === 'follow-up'
    || telemetry.priorContextUsed === true
    || telemetry.followupResolvedFromHistory === true
    || (unit.priorContextSummary && unit.priorContextSummary.available === true)
    || (Array.isArray(unit.observationBlockers) && unit.observationBlockers.some((item) => item && item.code === 'missing_prior_context_summary'));
}

function buildAvailabilityRow(reviewUnits, config) {
  const source = Array.isArray(reviewUnits) ? reviewUnits : [];
  const applicable = typeof config.isApplicable === 'function' ? config.isApplicable : () => true;
  const isTrue = typeof config.isTrue === 'function' ? config.isTrue : () => false;
  const isMissing = typeof config.isMissing === 'function' ? config.isMissing : () => false;
  let sampleCount = 0;
  let missingCount = 0;
  let falseCount = 0;
  let trueCount = 0;

  source.forEach((row) => {
    if (!applicable(row)) return;
    sampleCount += 1;
    if (isMissing(row)) {
      missingCount += 1;
      return;
    }
    if (isTrue(row)) {
      trueCount += 1;
    } else {
      falseCount += 1;
    }
  });

  const value = sampleCount > 0 ? Math.round((trueCount / sampleCount) * 10000) / 10000 : 0;
  return {
    value,
    sampleCount,
    missingCount,
    falseCount,
    blockedCount: 0,
    unavailableCount: 0,
    status: resolveMetricStatus({
      value,
      sampleCount,
      missingCount,
      blockedCount: 0,
      unavailableCount: 0,
      threshold: config.threshold || KPI_THRESHOLDS.availability
    })
  };
}

function aggregateAvailabilityMetric(reviewUnits, config) {
  const rows = Array.isArray(reviewUnits) ? reviewUnits : [];
  const grouped = groupBySlice(rows, (row) => row && row.slice);
  const bySlice = {};
  grouped.forEach((sliceRows, slice) => {
    bySlice[slice] = buildAvailabilityRow(sliceRows, config);
  });
  return buildMetricEnvelope(Object.assign(
    {},
    buildAvailabilityRow(rows, config),
    {
      provenance: KPI_PROVENANCE,
      sourceCollections: ['conversation_review_snapshots'],
      observationBlockers: [],
      bySlice
    }
  ));
}

function aggregateBlockerRateMetric(evaluations, config) {
  const rows = Array.isArray(evaluations) ? evaluations : [];
  const grouped = groupBySlice(rows, (row) => row && row.slice);
  const threshold = config.threshold || KPI_THRESHOLDS.blockerRate;
  const predicate = typeof config.predicate === 'function'
    ? config.predicate
    : () => false;
  const applicable = typeof config.isApplicable === 'function'
    ? config.isApplicable
    : () => true;

  function aggregateRows(input) {
    const scoped = Array.isArray(input) ? input.filter((row) => applicable(row)) : [];
    let sampleCount = 0;
    let falseCount = 0;
    let blockedCount = 0;
    const blockers = [];
    const sourceCollections = new Set();
    scoped.forEach((row) => {
      (Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []).forEach((item) => sourceCollections.add(item));
      sampleCount += 1;
      if (predicate(row)) {
        blockedCount += 1;
        blockers.push({ blockers: row && row.observationBlockers, slice: row && row.slice });
      } else {
        falseCount += 1;
      }
    });
    const value = sampleCount > 0 ? Math.round((blockedCount / sampleCount) * 10000) / 10000 : 0;
    return {
      value,
      sampleCount,
      missingCount: 0,
      falseCount,
      blockedCount,
      unavailableCount: 0,
      status: resolveMetricStatus({ value, sampleCount, missingCount: 0, blockedCount, unavailableCount: 0, threshold }),
      sourceCollections: Array.from(sourceCollections).sort((left, right) => left.localeCompare(right, 'ja')),
      observationBlockers: mergeObservationBlockers(blockers)
    };
  }

  const bySlice = {};
  grouped.forEach((sliceRows, slice) => {
    bySlice[slice] = aggregateRows(sliceRows);
  });
  return buildMetricEnvelope(Object.assign({}, aggregateRows(rows), {
    provenance: KPI_PROVENANCE,
    bySlice
  }));
}

function buildSummary(metrics, issueCandidateMetrics, reviewUnitCount, sliceCounts, observationBlockers) {
  const signalStatuses = [
    metrics.naturalness.status,
    metrics.continuity.status,
    metrics.specificity.status,
    metrics.proceduralUtility.status,
    metrics.knowledgeUse.status,
    metrics.fallbackRepetition.status
  ];
  const blockerStatuses = [
    metrics.observationBlockerRate.status,
    metrics.blockedFollowupJudgementRate.status,
    metrics.blockedKnowledgeJudgementRate.status
  ];
  const issueStatuses = Object.values(issueCandidateMetrics).map((row) => row.status);
  let overallStatus = 'pass';
  if (reviewUnitCount <= 0) overallStatus = 'unavailable';
  else if (signalStatuses.every((status) => status === 'blocked' || status === 'unavailable')) {
    overallStatus = Array.isArray(observationBlockers) && observationBlockers.length > 0 ? 'blocked' : 'unavailable';
  } else if (signalStatuses.includes('fail')) overallStatus = 'fail';
  else if (signalStatuses.includes('warn')) overallStatus = 'warn';
  else if (blockerStatuses.includes('fail') || blockerStatuses.includes('warn') || issueStatuses.includes('fail') || issueStatuses.includes('warn')) overallStatus = 'warn';

  return {
    overallStatus,
    reviewUnitCount,
    sliceCounts
  };
}

function buildPatrolKpis(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const evaluations = Array.isArray(payload.evaluations) ? payload.evaluations : [];
  const reviewUnits = Array.isArray(payload.reviewUnits) ? payload.reviewUnits : [];
  const transcriptCoverage = normalizeTranscriptCoverage(reviewUnits, payload.transcriptCoverage);
  const sourceCollections = mergeSourceCollections(
    evaluations.flatMap((row) => Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []),
    reviewUnits.flatMap((row) => Array.isArray(row && row.sourceCollections) ? row.sourceCollections : []),
    transcriptCoverage.sourceCollections
  );
  const aggregatedBlockers = mergeObservationBlockers(
    evaluations.map((row) => ({ blockers: row && row.observationBlockers, slice: row && row.slice }))
  );

  const metrics = {
    naturalness: aggregateSignalMetric(evaluations, 'naturalness', KPI_THRESHOLDS.signal),
    continuity: aggregateSignalMetric(evaluations, 'continuity', KPI_THRESHOLDS.signal),
    specificity: aggregateSignalMetric(evaluations, 'specificity', KPI_THRESHOLDS.signal),
    proceduralUtility: aggregateSignalMetric(evaluations, 'proceduralUtility', KPI_THRESHOLDS.signal),
    knowledgeUse: aggregateSignalMetric(evaluations, 'knowledgeUse', KPI_THRESHOLDS.signal),
    fallbackRepetition: aggregateSignalMetric(evaluations, 'fallbackRepetition', KPI_THRESHOLDS.repetitionRisk),
    reviewableTranscriptRate: aggregateAvailabilityMetric(reviewUnits, {
      isApplicable: () => true,
      isTrue: (unit) =>
        unit && unit.userMessage && unit.userMessage.available === true
        && unit.assistantReply && unit.assistantReply.available === true
        && !(Array.isArray(unit.observationBlockers) && unit.observationBlockers.some((item) => item && item.code === 'transcript_not_reviewable'))
    }),
    userMessageAvailableRate: aggregateAvailabilityMetric(reviewUnits, {
      isApplicable: () => true,
      isTrue: (unit) => unit && unit.userMessage && unit.userMessage.available === true,
      isMissing: (unit) => !unit || !unit.userMessage || typeof unit.userMessage.available !== 'boolean'
    }),
    assistantReplyAvailableRate: aggregateAvailabilityMetric(reviewUnits, {
      isApplicable: () => true,
      isTrue: (unit) => unit && unit.assistantReply && unit.assistantReply.available === true,
      isMissing: (unit) => !unit || !unit.assistantReply || typeof unit.assistantReply.available !== 'boolean'
    }),
    priorContextSummaryAvailableRate: aggregateAvailabilityMetric(reviewUnits, {
      isApplicable: (unit) => reviewUnitNeedsPriorContext(unit),
      isTrue: (unit) => unit && unit.priorContextSummary && unit.priorContextSummary.available === true,
      isMissing: (unit) => !unit || !unit.priorContextSummary || typeof unit.priorContextSummary.available !== 'boolean'
    }),
    transcriptAvailability: (function buildTranscriptAvailability() {
      const rows = Array.isArray(reviewUnits) ? reviewUnits : [];
      const normalized = rows.map((unit) => ({
        unit,
        slice: unit && unit.slice,
        expectedSlots: reviewUnitNeedsPriorContext(unit) ? 3 : 2,
        availableSlots:
          ((unit && unit.userMessage && unit.userMessage.available === true) ? 1 : 0)
          + ((unit && unit.assistantReply && unit.assistantReply.available === true) ? 1 : 0)
          + (reviewUnitNeedsPriorContext(unit) && unit && unit.priorContextSummary && unit.priorContextSummary.available === true ? 1 : 0),
        missingSlots:
          ((unit && unit.userMessage && typeof unit.userMessage.available === 'boolean') ? 0 : 1)
          + ((unit && unit.assistantReply && typeof unit.assistantReply.available === 'boolean') ? 0 : 1)
          + (reviewUnitNeedsPriorContext(unit) && (!unit || !unit.priorContextSummary || typeof unit.priorContextSummary.available !== 'boolean') ? 1 : 0)
      }));
      function aggregateSlotRows(input) {
        const scoped = Array.isArray(input) ? input : [];
        const sampleCount = scoped.reduce((sum, row) => sum + row.expectedSlots, 0);
        const trueCount = scoped.reduce((sum, row) => sum + row.availableSlots, 0);
        const missingCount = scoped.reduce((sum, row) => sum + row.missingSlots, 0);
        const falseCount = Math.max(0, sampleCount - trueCount - missingCount);
        const value = sampleCount > 0 ? Math.round((trueCount / sampleCount) * 10000) / 10000 : 0;
        return {
          value,
          sampleCount,
          missingCount,
          falseCount,
          blockedCount: 0,
          unavailableCount: 0,
          status: resolveMetricStatus({ value, sampleCount, missingCount, blockedCount: 0, unavailableCount: 0, threshold: KPI_THRESHOLDS.availability })
        };
      }
      const grouped = groupBySlice(normalized, (row) => row && row.slice);
      const bySlice = {};
      grouped.forEach((sliceRows, slice) => {
        bySlice[slice] = aggregateSlotRows(sliceRows);
      });
      return buildMetricEnvelope(Object.assign({}, aggregateSlotRows(normalized), {
        provenance: KPI_PROVENANCE,
        sourceCollections: ['conversation_review_snapshots'],
        observationBlockers: [],
        bySlice
      }));
    })(),
    observationBlockerRate: aggregateBlockerRateMetric(evaluations, {
      predicate: (row) => Array.isArray(row && row.observationBlockers) && row.observationBlockers.length > 0
    }),
    blockedFollowupJudgementRate: aggregateBlockerRateMetric(evaluations, {
      isApplicable: (row) => row && row.slice === 'follow-up',
      predicate: (row) => Array.isArray(row && row.observationBlockers) && row.observationBlockers.some((item) => item && item.code === 'insufficient_context_for_followup_judgement')
    }),
    blockedKnowledgeJudgementRate: aggregateBlockerRateMetric(evaluations, {
      predicate: (row) => Array.isArray(row && row.observationBlockers) && row.observationBlockers.some((item) => item && item.code === 'insufficient_knowledge_signals')
    })
  };

  const issueCandidateMetrics = {
    broadAbstractEscapeRate: aggregateIssueCandidateMetric(evaluations, 'broad_abstract_escape', KPI_THRESHOLDS.issueRate, (row) => row && row.slice === 'broad'),
    followupContextResetRate: aggregateIssueCandidateMetric(evaluations, 'followup_context_reset', KPI_THRESHOLDS.issueRate, (row) => row && row.slice === 'follow-up'),
    citySpecificityMissingRate: aggregateIssueCandidateMetric(evaluations, 'city_specificity_missing', KPI_THRESHOLDS.issueRate, (row) => row && row.slice === 'city'),
    nextStepMissingRate: aggregateIssueCandidateMetric(evaluations, 'next_step_missing', KPI_THRESHOLDS.issueRate, () => true),
    repeatedTemplateResponseRate: aggregateIssueCandidateMetric(evaluations, 'repeated_template_response', KPI_THRESHOLDS.issueRate, () => true),
    knowledgeActivationMissingRate: aggregateIssueCandidateMetric(evaluations, 'knowledge_activation_missing', KPI_THRESHOLDS.issueRate, () => true),
    savedFaqUnusedRate: aggregateIssueCandidateMetric(evaluations, 'saved_faq_unused', KPI_THRESHOLDS.issueRate, () => true),
    cityPackUnusedRate: aggregateIssueCandidateMetric(evaluations, 'city_pack_unused', KPI_THRESHOLDS.issueRate, () => true),
    conciergeDirectAnswerMissingRate: aggregateIssueCandidateMetric(evaluations, 'concierge_direct_answer_missing', KPI_THRESHOLDS.issueRate, () => true),
    conciergeContextCarryMissingRate: aggregateIssueCandidateMetric(evaluations, 'concierge_context_carry_missing', KPI_THRESHOLDS.issueRate, (row) => row && row.slice === 'follow-up'),
    conciergeKnowledgeBypassRate: aggregateIssueCandidateMetric(evaluations, 'concierge_knowledge_bypass', KPI_THRESHOLDS.issueRate, () => true),
    conciergeTemplateOveruseRate: aggregateIssueCandidateMetric(evaluations, 'concierge_template_overuse', KPI_THRESHOLDS.issueRate, () => true),
    genericLoopFixedReplyRate: aggregateIssueCandidateMetric(evaluations, 'generic_loop_fixed_reply', KPI_THRESHOLDS.issueRate, () => true),
    detailFormatDropRate: aggregateIssueCandidateMetric(evaluations, 'detail_format_drop', KPI_THRESHOLDS.issueRate, () => true),
    correctionIgnoredRate: aggregateIssueCandidateMetric(evaluations, 'correction_ignored', KPI_THRESHOLDS.issueRate, () => true),
    mixedDomainCollapseRate: aggregateIssueCandidateMetric(evaluations, 'mixed_domain_collapse', KPI_THRESHOLDS.issueRate, () => true),
    followupOveraskRate: aggregateIssueCandidateMetric(evaluations, 'followup_overask', KPI_THRESHOLDS.issueRate, () => true),
    internalLabelLeakRate: aggregateIssueCandidateMetric(evaluations, 'internal_label_leak', KPI_THRESHOLDS.issueRate, () => true),
    commandBoundaryCollisionRate: aggregateIssueCandidateMetric(evaluations, 'command_boundary_collision', KPI_THRESHOLDS.issueRate, () => true),
    punctuationAnomalyRate: aggregateIssueCandidateMetric(evaluations, 'punctuation_anomaly', KPI_THRESHOLDS.issueRate, () => true),
    parrotEchoRate: aggregateIssueCandidateMetric(evaluations, 'parrot_echo', KPI_THRESHOLDS.issueRate, () => true)
  };

  return {
    summary: buildSummary(metrics, issueCandidateMetrics, evaluations.length, normalizeSliceCounts(evaluations), aggregatedBlockers),
    metrics,
    issueCandidateMetrics,
    transcriptCoverage,
    observationBlockers: aggregatedBlockers,
    provenance: KPI_PROVENANCE,
    sourceCollections
  };
}

module.exports = {
  buildPatrolKpis
};
