'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson, buildScorecard } = require('./lib');
const { validateManifest } = require('./benchmark_registry');
const { evaluateRisk } = require('./contamination_guard');
const { summarize } = require('./judge_calibration');
const { evaluateSliceGate } = require('./slice_gate');
const { evaluateFrontier } = require('./frontier_eval');

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num <= 0) return 0;
  if (num >= 1) return 1;
  return num;
}

function buildConversationDimensionOverrides(payload) {
  const conversation = payload && typeof payload === 'object'
    ? (payload.summary && payload.summary.conversationQuality && typeof payload.summary.conversationQuality === 'object'
      ? payload.summary.conversationQuality
      : (payload.conversationQuality && typeof payload.conversationQuality === 'object' ? payload.conversationQuality : null))
    : null;
  if (!conversation) return {};

  const legacyTemplateHitRate = clamp01(conversation.legacyTemplateHitRate);
  const defaultCasualRate = clamp01(conversation.defaultCasualRate);
  const contradictionRate = clamp01(conversation.contradictionRate);
  const conciseRate = clamp01(conversation.conciseModeAppliedRate);
  const repetitionPreventedRate = clamp01(conversation.repetitionPreventedRate);
  const directAnswerRate = clamp01(conversation.directAnswerAppliedRate);
  const clarifySuppressedRate = clamp01(conversation.clarifySuppressedRate);
  const contextCarryScore = clamp01(conversation.avgContextCarryScore);
  const repeatRiskScore = clamp01(conversation.avgRepeatRiskScore);
  const followupRate = clamp01(conversation.followupQuestionIncludedRate);
  const retrieveNeededRate = clamp01(conversation.retrieveNeededRate);
  const followupCarryFromHistoryRate = Number.isFinite(Number(conversation.followupCarryFromHistoryRate))
    ? clamp01(conversation.followupCarryFromHistoryRate)
    : clamp01((contextCarryScore + directAnswerRate) / 2);
  const contextualResumeHandledRate = Number.isFinite(Number(conversation.contextualResumeHandledRate))
    ? clamp01(conversation.contextualResumeHandledRate)
    : clamp01((contextCarryScore + followupCarryFromHistoryRate + directAnswerRate) / 3);
  const followupResolutionRate = Number.isFinite(Number(conversation.followupResolutionRate))
    ? clamp01(conversation.followupResolutionRate)
    : clamp01((directAnswerRate + clarifySuppressedRate + contextCarryScore) / 3);
  const recoverySignalRate = Number.isFinite(Number(conversation.recoverySignalRate))
    ? clamp01(conversation.recoverySignalRate)
    : clamp01((repetitionPreventedRate + followupCarryFromHistoryRate) / 2);
  const misunderstandingRecoveredRate = Number.isFinite(Number(conversation.misunderstandingRecoveredRate))
    ? clamp01(conversation.misunderstandingRecoveredRate)
    : clamp01((recoverySignalRate + directAnswerRate + (1 - repeatRiskScore)) / 3);
  const recoveryHandledRate = Number.isFinite(Number(conversation.recoveryHandledRate))
    ? clamp01(conversation.recoveryHandledRate)
    : clamp01((repetitionPreventedRate + directAnswerRate + clarifySuppressedRate) / 3);
  const domainConciergeRate = Number.isFinite(Number(conversation.domainIntentConciergeRate))
    ? clamp01(conversation.domainIntentConciergeRate)
    : clamp01((directAnswerRate + contextCarryScore + followupResolutionRate) / 3);
  const unsupportedClaims = Number.isFinite(Number(conversation.avgUnsupportedClaimCount))
    ? clamp01(1 - Math.min(1, Number(conversation.avgUnsupportedClaimCount)))
    : 1;
  const officialOnlyRate = Number.isFinite(Number(conversation.officialOnlySatisfiedRate))
    ? clamp01(conversation.officialOnlySatisfiedRate)
    : clamp01((1 - contradictionRate + directAnswerRate) / 2);

  return {
    procedural_utility: clamp01((domainConciergeRate + conciseRate + directAnswerRate) / 3),
    next_step_clarity: clamp01((conciseRate + followupRate + repetitionPreventedRate + directAnswerRate) / 4),
    conversation_continuity: clamp01(
      (
        1 - defaultCasualRate
        + domainConciergeRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + directAnswerRate
        + clarifySuppressedRate
        + followupResolutionRate
        + contextualResumeHandledRate
      ) / 8
    ),
    short_followup_understanding: clamp01((1 - defaultCasualRate + followupRate + contextCarryScore + directAnswerRate) / 4),
    clarification_quality: clamp01(
      (
        1 - Math.max(0, 0.3 - followupResolutionRate)
        + clarifySuppressedRate
        + directAnswerRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + followupResolutionRate
        + contextualResumeHandledRate
      ) / 7
    ),
    direct_answer_first: clamp01((directAnswerRate + conciseRate) / 2),
    japanese_naturalness: clamp01((conciseRate + directAnswerRate + followupResolutionRate) / 3),
    keigo_distance: clamp01((conciseRate + clarifySuppressedRate + contextCarryScore) / 3),
    empathy: clamp01(
      (
        followupRate
        + conciseRate
        + directAnswerRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + followupResolutionRate
      ) / 6
    ),
    misunderstanding_recovery: clamp01(
      (
        misunderstandingRecoveredRate
        + repetitionPreventedRate
        + directAnswerRate
        + (1 - repeatRiskScore)
        + contextCarryScore
        + followupCarryFromHistoryRate
        + recoverySignalRate
        + recoveryHandledRate
        + followupResolutionRate
      ) / 9
    ),
    latency_surface_efficiency: clamp01(
      (
        conciseRate
        + (1 - retrieveNeededRate)
        + (1 - repeatRiskScore)
        + directAnswerRate
        + followupCarryFromHistoryRate
        + contextualResumeHandledRate
      ) / 6
    ),
    line_native_fit: clamp01((conciseRate + directAnswerRate + (1 - retrieveNeededRate)) / 3),
    japanese_service_quality: clamp01((conciseRate + followupRate + (1 - legacyTemplateHitRate)) / 3),
    minority_persona_robustness: clamp01((followupRate + unsupportedClaims) / 2),
    escalation_appropriateness: clamp01((officialOnlyRate + (1 - contradictionRate)) / 2)
  };
}

function toCandidateMetricsFromQualitySummary(payload) {
  const quality = payload && typeof payload === 'object'
    ? (payload.summary && typeof payload.summary === 'object'
      ? payload.summary.qualityFramework
      : payload.qualityFramework)
    : null;
  if (!quality || typeof quality !== 'object') return null;
  const dimensions = {};
  (Array.isArray(quality.dimensions) ? quality.dimensions : []).forEach((row) => {
    if (!row || typeof row !== 'object' || typeof row.key !== 'string') return;
    dimensions[row.key] = Number.isFinite(Number(row.score)) ? Number(row.score) : 0;
  });
  const conversationOverrides = buildConversationDimensionOverrides(payload);
  Object.keys(conversationOverrides).forEach((key) => {
    const override = clamp01(conversationOverrides[key]);
    const existing = clamp01(dimensions[key]);
    dimensions[key] = Math.max(existing, override);
  });
  const slices = {};
  (Array.isArray(quality.slices) ? quality.slices : []).forEach((row) => {
    if (!row || typeof row !== 'object' || typeof row.sliceKey !== 'string') return;
    slices[row.sliceKey] = {
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : 0,
      sampleCount: Number.isFinite(Number(row.sampleCount)) ? Number(row.sampleCount) : 0
    };
  });
  const hardGate = quality.hardGate && typeof quality.hardGate === 'object' ? quality.hardGate : {};
  const hardFailures = Array.isArray(hardGate.failures) ? hardGate.failures.map((item) => String(item || '').toLowerCase()) : [];
  const hasFailure = (keyword) => hardFailures.some((item) => item.includes(keyword));
  return {
    dimensions,
    slices,
    hard: {
      safetyPass: !hasFailure('safety'),
      privacyPass: !hasFailure('privacy'),
      actionPolicyPass: !hasFailure('action_policy'),
      factualityPass: !hasFailure('factuality')
    },
    judge: quality.judgeCalibration && typeof quality.judgeCalibration === 'object'
      ? quality.judgeCalibration
      : {},
    benchmark: quality.benchmark && typeof quality.benchmark === 'object'
      ? quality.benchmark
      : {},
    replay: quality.replay && typeof quality.replay === 'object'
      ? quality.replay
      : {},
    frontier: quality.frontier && typeof quality.frontier === 'object'
      ? quality.frontier
      : {}
  };
}

function resolveCandidateMetrics(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const summaryPath = payload.summaryPath;
  const summaryFallbackPath = payload.summaryFallbackPath;
  const candidateMetricsPath = payload.candidateMetricsPath;
  let runtimeSummaryReadable = false;
  let runtimeSummaryConverted = false;

  const trySummaryPath = [
    { pathValue: summaryPath, sourceType: 'runtime_summary' },
    { pathValue: summaryFallbackPath, sourceType: 'frozen_summary_fallback' }
  ].filter((item) => Boolean(item.pathValue));
  for (const source of trySummaryPath) {
    try {
      const summary = readJson(source.pathValue);
      if (source.sourceType === 'runtime_summary') runtimeSummaryReadable = true;
      const converted = toCandidateMetricsFromQualitySummary(summary);
      if (converted) {
        if (source.sourceType === 'runtime_summary') runtimeSummaryConverted = true;
        return {
          metrics: converted,
          source: source.pathValue,
          sourceType: source.sourceType,
          summary,
          runtimeSummarySource: summary && typeof summary.runtimeSummarySource === 'string'
            ? summary.runtimeSummarySource
            : null,
          runtimeSummaryReadable,
          runtimeSummaryConverted
        };
      }
      if (source.sourceType === 'runtime_summary') runtimeSummaryConverted = false;
    } catch (_err) {
      // summary missing or malformed -> fallback to next source
    }
  }
  return {
    metrics: readJson(candidateMetricsPath),
    source: candidateMetricsPath,
    sourceType: 'candidate_metrics_fallback',
    summary: null,
    runtimeSummarySource: null,
    runtimeSummaryReadable,
    runtimeSummaryConverted
  };
}

function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function parseRate(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function normalizeRuntimeSummarySource(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function extractQualityLoopV2(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const summaryNode = payload.summary && typeof payload.summary === 'object' ? payload.summary : payload;
  const qualityFramework = summaryNode.qualityFramework && typeof summaryNode.qualityFramework === 'object'
    ? summaryNode.qualityFramework
    : null;
  if (!qualityFramework || !qualityFramework.qualityLoopV2 || typeof qualityFramework.qualityLoopV2 !== 'object') {
    return null;
  }
  return qualityFramework.qualityLoopV2;
}

function extractImprovementLoop(payload) {
  const qualityLoopV2 = extractQualityLoopV2(payload);
  if (!qualityLoopV2 || !qualityLoopV2.improvementLoop || typeof qualityLoopV2.improvementLoop !== 'object') {
    return null;
  }
  return qualityLoopV2.improvementLoop;
}

function isRuntimeSummaryProvenanceAccepted(value) {
  const source = normalizeRuntimeSummarySource(value);
  if (!source) return false;
  return [
    'seeded_from_frozen_runtime_snapshot',
    'forced_refresh_from_frozen_runtime_snapshot',
    'frozen_summary_fallback',
    'runtime_live',
    'runtime_summary_live',
    'runtime_collected',
    'existing_runtime_summary_kept'
  ].includes(source);
}

function isLiveRuntimeSummaryProvenance(value) {
  const source = normalizeRuntimeSummarySource(value);
  if (!source) return false;
  return [
    'runtime_live',
    'runtime_summary_live',
    'runtime_collected',
    'existing_runtime_summary_kept'
  ].includes(source);
}

function resolveCompatShareWindow(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const summaryNode = summary.summary && typeof summary.summary === 'object' ? summary.summary : summary;
  const optimization = summaryNode.optimization && typeof summaryNode.optimization === 'object'
    ? summaryNode.optimization
    : null;
  if (!optimization) return null;
  const raw = Number(optimization.compatShareWindow);
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

function main(argv) {
  const args = parseArgs(argv);
  const baselineMetricsPath = args.baseline
    ? path.resolve(process.cwd(), args.baseline)
    : path.join(__dirname, 'fixtures', 'baseline_metrics.v1.json');
  const candidateMetricsPath = args.candidate
    ? path.resolve(process.cwd(), args.candidate)
    : path.join(__dirname, 'fixtures', 'candidate_metrics.v1.json');
  const summaryPath = args.summary
    ? path.resolve(process.cwd(), args.summary)
    : path.join(process.cwd(), 'tmp', 'llm_usage_summary.json');
  const summaryFallbackPath = args.summaryFallback
    ? path.resolve(process.cwd(), args.summaryFallback)
    : path.join(__dirname, 'fixtures', 'usage_summary_candidate.v1.json');
  const adjudicationPath = args.adjudication
    ? path.resolve(process.cwd(), args.adjudication)
    : path.join(__dirname, 'fixtures', 'human_adjudication_set.v1.json');
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : path.join(process.cwd(), 'benchmarks', 'registry', 'manifest.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_gate_result.json');
  const requireAllSlicesPass = toBool(
    args.requireAllSlicesPass,
    toBool(process.env.LLM_QUALITY_REQUIRE_ALL_SLICES_PASS, false)
  );
  const requireRuntimeSummary = toBool(
    args.requireRuntimeSummary,
    toBool(process.env.LLM_QUALITY_REQUIRE_RUNTIME_SUMMARY, false)
  );
  const requireRuntimeProvenance = toBool(
    args.requireRuntimeProvenance,
    toBool(process.env.LLM_QUALITY_REQUIRE_RUNTIME_PROVENANCE, false)
  );
  const requireCompatGovernance = toBool(
    args.requireCompatGovernance,
    toBool(process.env.LLM_QUALITY_REQUIRE_COMPAT_GOVERNANCE, false)
  );
  const requireLiveRuntimeAudit = toBool(
    args.requireLiveRuntimeAudit,
    toBool(process.env.LLM_QUALITY_REQUIRE_LIVE_RUNTIME_AUDIT, false)
  );
  const requireNoGoGateMandatory = toBool(
    args.requireNoGoGateMandatory,
    toBool(process.env.LLM_QUALITY_REQUIRE_NOGO_GATE_MANDATORY, false)
  );
  const maxCompatShare = parseRate(
    args.maxCompatShare,
    parseRate(process.env.LLM_QUALITY_MAX_COMPAT_SHARE, 0.15)
  );

  const baselineMetrics = readJson(baselineMetricsPath);
  const candidateResolved = resolveCandidateMetrics({
    summaryPath,
    summaryFallbackPath,
    candidateMetricsPath
  });
  const candidateMetrics = candidateResolved.metrics;
  const candidateSourcePath = candidateResolved.source;
  const candidateSourceType = candidateResolved.sourceType || 'candidate_metrics_fallback';
  const runtimeSummarySource = candidateResolved.runtimeSummarySource;
  const sourceSummary = candidateResolved.summary;
  const qualityLoopV2 = extractQualityLoopV2(sourceSummary);
  const improvementLoop = extractImprovementLoop(sourceSummary);
  const compatShareWindow = resolveCompatShareWindow(sourceSummary);
  const runtimeSummaryReadable = candidateResolved.runtimeSummaryReadable === true;
  const runtimeSummaryConverted = candidateResolved.runtimeSummaryConverted === true;
  const adjudicationRows = readJson(adjudicationPath);
  const manifest = readJson(manifestPath);

  const benchmarkRegistry = validateManifest(manifest);
  const contamination = evaluateRisk(manifest);
  const judgeCalibration = summarize(adjudicationRows);

  candidateMetrics.judge = Object.assign({}, candidateMetrics.judge || {}, {
    confidence: judgeCalibration.confidence,
    disagreementRate: judgeCalibration.disagreementRate,
    multilingualStability: judgeCalibration.multilingualStability,
    promptSensitivityDrift: judgeCalibration.promptSensitivityDrift,
    humanReviewRequired: judgeCalibration.reliabilityPolicy.humanReviewRequired
  });

  candidateMetrics.benchmark = Object.assign({}, candidateMetrics.benchmark || {}, {
    version: manifest.version,
    frozen: manifest.frozen === true,
    contaminationRisk: contamination.hardGateOverall || contamination.overall,
    contaminationRegistryRisk: contamination.overall,
    artifactHash: manifest.artifactHash || null
  });

  const baselineScorecard = buildScorecard(baselineMetrics, { source: baselineMetricsPath });
  const candidateScorecard = buildScorecard(candidateMetrics, { source: candidateSourcePath });

  const sliceGate = evaluateSliceGate(candidateScorecard, { requireAllSlicesPass });
  const frontier = evaluateFrontier(baselineScorecard, candidateScorecard);

  const replay = candidateMetrics.replay && typeof candidateMetrics.replay === 'object'
    ? candidateMetrics.replay
    : { totalCases: 0, criticalFailures: 0, warningFailures: 0 };

  const failures = [];
  const warnings = [];

  if (benchmarkRegistry.ok !== true) failures.push('benchmark_registry_invalid');
  if (toBool(manifest.frozen, false) !== true) failures.push('benchmark_not_frozen');
  const highRiskMixedIntoHardGate = Array.isArray(contamination.excludedFixtureIds)
    && contamination.excludedFixtureIds.some((id) => (contamination.hardGateEligibleFixtureIds || []).includes(id));
  if (highRiskMixedIntoHardGate) failures.push('contamination_high_risk_mixed_into_hard_gate');
  if ((contamination.hardGateOverall || contamination.overall) === 'high') {
    warnings.push('contamination_risk_high_hard_gate');
  }
  if (sliceGate.pass !== true) failures.push('slice_gate_failed');
  if (frontier.pass !== true) failures.push('frontier_gate_failed');
  if (candidateScorecard.hardGate.pass !== true) failures.push('quality_hard_gate_failed');
  if (judgeCalibration.reliabilityPolicy.humanReviewRequired === true) failures.push('judge_human_review_required');
  if (Number(replay.criticalFailures || 0) > 0) failures.push('replay_critical_failures');
  if (candidateSourceType !== 'runtime_summary') warnings.push('runtime_summary_not_used');
  if (requireRuntimeSummary === true && candidateSourceType !== 'runtime_summary') {
    failures.push('runtime_summary_required_but_missing');
  }
  if (requireRuntimeProvenance === true) {
    if (candidateSourceType !== 'runtime_summary') {
      failures.push('runtime_summary_provenance_missing');
    } else if (!isRuntimeSummaryProvenanceAccepted(runtimeSummarySource)) {
      failures.push(`runtime_summary_provenance_invalid:${normalizeRuntimeSummarySource(runtimeSummarySource) || 'unknown'}`);
    }
  }
  if (requireLiveRuntimeAudit === true) {
    if (candidateSourceType !== 'runtime_summary') {
      failures.push('live_runtime_audit_required_but_runtime_summary_missing');
    } else if (!isLiveRuntimeSummaryProvenance(runtimeSummarySource)) {
      failures.push(`live_runtime_audit_provenance_invalid:${normalizeRuntimeSummarySource(runtimeSummarySource) || 'unknown'}`);
    }
    if (!improvementLoop) {
      failures.push('quality_loop_v2_improvement_loop_missing');
    } else if (improvementLoop.runtimeAuditUnavailable === true) {
      failures.push('runtime_audit_unavailable');
    }
  }
  if (requireCompatGovernance === true) {
    if (!Number.isFinite(Number(compatShareWindow))) {
      failures.push('compat_share_window_missing');
    } else if (Number(compatShareWindow) > maxCompatShare) {
      failures.push('compat_share_window_exceeded');
    }
    const compatSlice = Array.isArray(candidateScorecard.slices)
      ? candidateScorecard.slices.find((row) => row && row.sliceKey === 'compat')
      : null;
    if (!compatSlice || compatSlice.status !== 'pass') failures.push('compat_slice_not_pass');
  }
  if (requireNoGoGateMandatory === true) {
    if (!qualityLoopV2) {
      failures.push('quality_loop_v2_missing');
    } else {
      if (String(qualityLoopV2.rolloutStage || '') !== 'nogo_gate_mandatory') {
        failures.push(`quality_loop_v2_rollout_stage_not_mandatory:${String(qualityLoopV2.rolloutStage || 'missing')}`);
      }
      const criticalSlices = Array.isArray(qualityLoopV2.criticalSlices) ? qualityLoopV2.criticalSlices : [];
      if (criticalSlices.length === 0) {
        failures.push('quality_loop_v2_critical_slices_missing');
      } else {
        criticalSlices.forEach((row) => {
          if (!row || typeof row !== 'object') return;
          if (row.status !== 'pass') failures.push(`quality_loop_v2_critical_slice_fail:${String(row.sliceKey || 'unknown')}`);
        });
      }
    }
  }

  warnings.push(...candidateScorecard.hardGate.warnings);
  warnings.push(...sliceGate.warnings);
  warnings.push(...frontier.warnings);

  const result = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    baselineMetricsPath,
    candidateMetricsPath,
    candidateSourcePath,
    summaryPath,
    summaryFallbackPath,
    requireRuntimeSummary,
    requireRuntimeProvenance,
    requireLiveRuntimeAudit,
    runtimeSummarySource,
    requireCompatGovernance,
    requireNoGoGateMandatory,
    maxCompatShare,
    compatShareWindow,
    runtimeSummaryReadable,
    runtimeSummaryConverted,
    requireAllSlicesPass,
    adjudicationPath,
    manifestPath,
    candidateSourceType,
    qualityLoopV2,
    improvementLoop,
    benchmarkRegistry,
    contamination,
    judgeCalibration,
    baselineScorecard,
    candidateScorecard,
    sliceGate,
    frontier,
    replay,
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings))
  };

  writeJson(path.join(process.cwd(), 'tmp', 'llm_quality_baseline_scorecard.json'), baselineScorecard);
  writeJson(path.join(process.cwd(), 'tmp', 'llm_quality_candidate_scorecard.json'), candidateScorecard);
  writeJson(outPath, result);

  const target = result.ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main,
  buildConversationDimensionOverrides,
  toCandidateMetricsFromQualitySummary,
  resolveCandidateMetrics
};
