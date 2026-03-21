'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildScorecard } = require('./lib');
const { toCandidateMetricsFromQualitySummary } = require('./run_quality_gate');
const {
  buildConciergeReleaseSupport,
  CONCIERGE_RUNTIME_SIGNAL_KEYS
} = require('./concierge_quality');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const next = args[i + 1];
    out[key.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function toMap(rows, keyField) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = typeof row[keyField] === 'string' ? row[keyField].trim() : '';
    if (!key) return;
    map.set(key, row);
  });
  return map;
}

function metricImproved(before, after) {
  return Number(after || 0) >= Number(before || 0);
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

function checkDimensionNoRegression(baselineMap, candidateMap, key) {
  const before = baselineMap.get(key) || {};
  const after = candidateMap.get(key) || {};
  return {
    key,
    baseline: Number(before.score || 0),
    candidate: Number(after.score || 0),
    pass: metricImproved(before.score, after.score)
  };
}

function checkSliceNoCriticalRegression(baselineMap, candidateMap, sliceKey) {
  const before = baselineMap.get(sliceKey) || {};
  const after = candidateMap.get(sliceKey) || {};
  const beforeScore = Number(before.score || 0);
  const afterScore = Number(after.score || 0);
  return {
    sliceKey,
    baseline: beforeScore,
    candidate: afterScore,
    pass: after.status === 'pass' && afterScore >= beforeScore
  };
}

function checkSlicePassAndNoRegression(baselineMap, candidateMap, sliceKey) {
  const before = baselineMap.get(sliceKey) || {};
  const after = candidateMap.get(sliceKey) || {};
  const beforeScore = Number(before.score || 0);
  const afterScore = Number(after.score || 0);
  const pass = after.status === 'pass' && afterScore >= beforeScore;
  return {
    sliceKey,
    baseline: beforeScore,
    candidate: afterScore,
    pass
  };
}

function readSummaryData(summaryPath) {
  if (!summaryPath) return null;
  try {
    const payload = readJson(summaryPath);
    if (payload && typeof payload === 'object' && payload.summary && typeof payload.summary === 'object') {
      return Object.assign({}, payload.summary, {
        runtimeSummarySource: typeof payload.runtimeSummarySource === 'string'
          ? payload.runtimeSummarySource
          : payload.summary.runtimeSummarySource,
        preparedAt: typeof payload.preparedAt === 'string'
          ? payload.preparedAt
          : payload.summary.preparedAt
      });
    }
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_err) {
    return null;
  }
}

function buildCandidateScorecardFromSummary(summary, sourcePath) {
  const metrics = toCandidateMetricsFromQualitySummary(summary);
  if (!metrics) return null;
  return buildScorecard(metrics, {
    source: sourcePath ? `runtime_summary:${sourcePath}` : 'runtime_summary'
  });
}

function readFiniteNumber(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return null;
  const value = Number(obj[key]);
  return Number.isFinite(value) ? value : null;
}

function resolveCompatShareWindow(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const optimization = summary.optimization && typeof summary.optimization === 'object'
    ? summary.optimization
    : null;
  if (!optimization) return null;
  const raw = Number(optimization.compatShareWindow);
  if (!Number.isFinite(raw)) return null;
  if (raw < 0) return 0;
  if (raw > 1) return 1;
  return raw;
}

function extractQualityLoopV2(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const qualityFramework = summary.qualityFramework && typeof summary.qualityFramework === 'object'
    ? summary.qualityFramework
    : null;
  if (!qualityFramework || !qualityFramework.qualityLoopV2 || typeof qualityFramework.qualityLoopV2 !== 'object') {
    return null;
  }
  return qualityFramework.qualityLoopV2;
}

function extractImprovementLoop(summary) {
  const qualityLoopV2 = extractQualityLoopV2(summary);
  if (!qualityLoopV2 || !qualityLoopV2.improvementLoop || typeof qualityLoopV2.improvementLoop !== 'object') {
    return null;
  }
  return qualityLoopV2.improvementLoop;
}

function normalizeRuntimeSummarySource(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
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

const STRICT_RUNTIME_SIGNAL_KEYS = Object.freeze([
  'legacyTemplateHitRate',
  'defaultCasualRate',
  'followupQuestionIncludedRate',
  'conciseModeAppliedRate',
  'retrieveNeededRate',
  'avgActionCount',
  'directAnswerAppliedRate',
  'avgRepeatRiskScore',
  ...CONCIERGE_RUNTIME_SIGNAL_KEYS
]);

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const baselinePath = args.baseline
    ? path.resolve(root, args.baseline)
    : path.join(root, 'tmp', 'llm_quality_baseline_scorecard.json');
  const candidatePath = args.candidate
    ? path.resolve(root, args.candidate)
    : path.join(root, 'tmp', 'llm_quality_candidate_scorecard.json');
  const mustPassPath = args.mustPass
    ? path.resolve(root, args.mustPass)
    : path.join(root, 'tmp', 'llm_quality_must_pass_result.json');
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_release_policy_result.json');
  const summaryPath = args.summary
    ? path.resolve(root, args.summary)
    : path.join(root, 'tmp', 'llm_usage_summary.json');
  const requireAllSlicesPass = toBool(
    args.requireAllSlicesPass,
    toBool(process.env.LLM_QUALITY_REQUIRE_ALL_SLICES_PASS, false)
  );
  const requireStrictRuntimeSignals = toBool(
    args.requireStrictRuntimeSignals,
    toBool(process.env.LLM_QUALITY_REQUIRE_STRICT_RUNTIME_SIGNALS, false)
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
  const requireSoftFloor = toBool(
    args.requireSoftFloor,
    toBool(process.env.LLM_QUALITY_REQUIRE_SOFT_FLOOR_080, false)
  );
  const softFloor = Number.isFinite(Number(args.softFloor))
    ? Number(args.softFloor)
    : Number.isFinite(Number(process.env.LLM_QUALITY_SOFT_FLOOR_VALUE))
      ? Number(process.env.LLM_QUALITY_SOFT_FLOOR_VALUE)
      : 0.8;

  const baseline = readJson(baselinePath);
  const precomputedCandidate = readJson(candidatePath);
  const mustPass = readJson(mustPassPath);
  const summary = readSummaryData(summaryPath);
  const runtimeSummaryCandidate = buildCandidateScorecardFromSummary(summary, summaryPath);
  const candidate = runtimeSummaryCandidate || precomputedCandidate;
  const candidateSourceType = runtimeSummaryCandidate ? 'runtime_summary' : 'precomputed_scorecard';
  const qualityLoopV2 = extractQualityLoopV2(summary);
  const improvementLoop = extractImprovementLoop(summary);
  const compatShareWindow = resolveCompatShareWindow(summary);
  const runtimeSummarySource = summary && typeof summary.runtimeSummarySource === 'string'
    ? summary.runtimeSummarySource
    : null;
  const conciergeSupport = buildConciergeReleaseSupport(summary);

  const baselineDimensionMap = toMap(baseline.dimensions, 'key');
  const candidateDimensionMap = toMap(candidate.dimensions, 'key');
  const baselineSliceMap = toMap(baseline.slices, 'sliceKey');
  const candidateSliceMap = toMap(candidate.slices, 'sliceKey');

  const failures = [];
  const warnings = [];

  const releaseGatePolicy = {
    overallImprovementRequired: true,
    hardGateNoRegression: true,
    factualitySafetyPrivacyNoRegression: true,
    continuityImprovementRequired: true,
    repetitionImprovementRequired: true,
    japaneseServiceImprovementRequired: true,
    lineNativeImprovementRequired: true,
    minorityCriticalRegressionForbidden: true,
    mustPassFixturesRequired: true,
    allSlicesPassRequired: requireAllSlicesPass === true,
    strictRuntimeSignalsRequired: requireStrictRuntimeSignals === true,
    compatGovernanceRequired: requireCompatGovernance === true,
    liveRuntimeAuditRequired: requireLiveRuntimeAudit === true,
    noGoGateMandatoryRequired: requireNoGoGateMandatory === true,
    unresolvedConciergeCriticalIssuesResolved: (requireStrictRuntimeSignals === true || requireNoGoGateMandatory === true),
    maxCompatShare,
    softFloorRequired: requireSoftFloor === true,
    softFloorValue: softFloor
  };

  if (!metricImproved(baseline.overallScore, candidate.overallScore)
    || Number(candidate.overallScore || 0) === Number(baseline.overallScore || 0)) {
    failures.push('overall_quality_not_improved');
  }

  if (candidate.hardGate && candidate.hardGate.pass !== true) {
    failures.push('candidate_hard_gate_failed');
  }

  const keyDimensions = [
    'factuality_grounding',
    'safety_compliance_privacy',
    'conversation_continuity',
    'repetition_loop_avoidance',
    'japanese_service_quality',
    'line_native_fit',
    'minority_persona_robustness'
  ].map((key) => checkDimensionNoRegression(baselineDimensionMap, candidateDimensionMap, key));

  keyDimensions.forEach((row) => {
    if (row.pass !== true) failures.push(`dimension_regressed:${row.key}`);
  });

  const criticalSlices = [
    'short_followup',
    'domain_continuation',
    'group_chat',
    'japanese_service_quality',
    'minority_personas',
    'cultural_slices'
  ].map((key) => checkSliceNoCriticalRegression(baselineSliceMap, candidateSliceMap, key));

  criticalSlices.forEach((row) => {
    if (row.pass !== true) failures.push(`critical_slice_failed:${row.sliceKey}`);
  });

  const softFloorChecks = Array.from(candidateDimensionMap.keys())
    .filter((key) => {
      const row = candidateDimensionMap.get(key) || {};
      return row.hardGate !== true;
    })
    .map((key) => {
      const row = candidateDimensionMap.get(key) || {};
      const score = Number(row.score || 0);
      return {
        key,
        score,
        pass: score >= softFloor
      };
    });
  if (requireSoftFloor === true) {
    softFloorChecks.forEach((row) => {
      if (!row.pass) failures.push(`soft_floor_unmet:${row.key}`);
    });
  } else {
    softFloorChecks.forEach((row) => {
      if (!row.pass) warnings.push(`soft_floor_warning:${row.key}`);
    });
  }

  const allSliceChecks = Array.from(candidateSliceMap.keys()).map((sliceKey) => (
    checkSlicePassAndNoRegression(baselineSliceMap, candidateSliceMap, sliceKey)
  ));
  if (requireAllSlicesPass === true) {
    allSliceChecks.forEach((row) => {
      if (row.pass !== true) failures.push(`slice_failed_or_not_improved:${row.sliceKey}`);
    });
  }
  if (requireCompatGovernance === true) {
    if (!Number.isFinite(Number(compatShareWindow))) failures.push('compat_share_window_missing');
    else if (Number(compatShareWindow) > maxCompatShare) failures.push('compat_share_window_exceeded');
    const compatSlice = candidateSliceMap.get('compat') || {};
    if (compatSlice.status !== 'pass') failures.push('compat_slice_not_pass');
  }
  if (requireLiveRuntimeAudit === true) {
    if (!isLiveRuntimeSummaryProvenance(runtimeSummarySource)) {
      failures.push(`live_runtime_audit_provenance_invalid:${normalizeRuntimeSummarySource(runtimeSummarySource) || 'unknown'}`);
    }
    if (!improvementLoop) {
      failures.push('quality_loop_v2_improvement_loop_missing');
    } else if (improvementLoop.runtimeAuditUnavailable === true) {
      failures.push('runtime_audit_unavailable');
    }
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

  conciergeSupport.criticalIssues.forEach((issue) => {
    if (!issue || issue.blocked !== true) return;
    const code = `concierge_critical_issue_unresolved:${issue.issueCode}`;
    if (requireNoGoGateMandatory === true || requireStrictRuntimeSignals === true) failures.push(code);
    else warnings.push(code);
  });

  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : null;
  const runtimeSignalKeys = STRICT_RUNTIME_SIGNAL_KEYS.slice();
  const runtimeSignalRaw = conversation
    ? runtimeSignalKeys.reduce((acc, key) => {
      acc[key] = readFiniteNumber(conversation, key);
      return acc;
    }, {})
    : null;
  const runtimeSignalCoverage = runtimeSignalRaw
    ? {
      requiredKeys: runtimeSignalKeys.slice(),
      availableKeys: runtimeSignalKeys.filter((key) => runtimeSignalRaw[key] != null),
      missingKeys: runtimeSignalKeys.filter((key) => runtimeSignalRaw[key] == null)
    }
    : {
      requiredKeys: runtimeSignalKeys.slice(),
      availableKeys: [],
      missingKeys: runtimeSignalKeys.slice()
    };
  const runtimeSignals = runtimeSignalRaw
    ? {
      defaultCasualRate: runtimeSignalRaw.defaultCasualRate,
      legacyTemplateHitRate: runtimeSignalRaw.legacyTemplateHitRate,
      followupQuestionIncludedRate: runtimeSignalRaw.followupQuestionIncludedRate,
      conciseModeAppliedRate: runtimeSignalRaw.conciseModeAppliedRate,
      retrieveNeededRate: runtimeSignalRaw.retrieveNeededRate,
      avgActionCount: runtimeSignalRaw.avgActionCount,
      directAnswerMissRate: runtimeSignalRaw.directAnswerAppliedRate == null
        ? null
        : Math.max(0, 1 - runtimeSignalRaw.directAnswerAppliedRate),
      avgRepeatRiskScore: runtimeSignalRaw.avgRepeatRiskScore,
      domainIntentConciergeRate: runtimeSignalRaw.domainIntentConciergeRate,
      officialOnlySatisfiedRate: runtimeSignalRaw.officialOnlySatisfiedRate,
      followupResolutionRate: runtimeSignalRaw.followupResolutionRate,
      contextualResumeHandledRate: runtimeSignalRaw.contextualResumeHandledRate,
      avgUnsupportedClaimCount: runtimeSignalRaw.avgUnsupportedClaimCount,
      formatComplianceRate: runtimeSignalRaw.formatComplianceRate,
      detailCarryRate: runtimeSignalRaw.detailCarryRate,
      correctionRecoveryRate: runtimeSignalRaw.correctionRecoveryRate,
      mixedDomainRetentionRate: runtimeSignalRaw.mixedDomainRetentionRate,
      followupOveraskRate: runtimeSignalRaw.followupOveraskRate,
      internalLabelLeakRate: runtimeSignalRaw.internalLabelLeakRate,
      parrotEchoRate: runtimeSignalRaw.parrotEchoRate,
      commandBoundaryCollisionRate: runtimeSignalRaw.commandBoundaryCollisionRate
    }
    : null;
  if (runtimeSignalCoverage.missingKeys.length > 0) {
    const missingCode = `runtime_signal_missing:${runtimeSignalCoverage.missingKeys.join(',')}`;
    if (requireStrictRuntimeSignals === true) failures.push(missingCode);
    else warnings.push(missingCode);
  }
  if (requireStrictRuntimeSignals === true && runtimeSignals) {
    if (runtimeSignals.defaultCasualRate != null && runtimeSignals.defaultCasualRate > 0.02) {
      failures.push('runtime_signal_default_casual_rate_too_high');
    }
    if (runtimeSignals.legacyTemplateHitRate != null && runtimeSignals.legacyTemplateHitRate > 0.005) {
      failures.push('runtime_signal_legacy_template_hit_rate_too_high');
    }
    if (runtimeSignals.retrieveNeededRate != null && runtimeSignals.retrieveNeededRate > 0.25) {
      failures.push('runtime_signal_retrieve_needed_rate_too_high');
    }
    if (runtimeSignals.avgActionCount != null && runtimeSignals.avgActionCount > 3.1) {
      failures.push('runtime_signal_avg_action_count_over_budget');
    }
    if (runtimeSignals.directAnswerMissRate != null && runtimeSignals.directAnswerMissRate > 0.08) {
      failures.push('runtime_signal_direct_answer_miss_rate_too_high');
    }
    if (runtimeSignals.avgRepeatRiskScore != null && runtimeSignals.avgRepeatRiskScore > 0.5) {
      failures.push('runtime_signal_repeat_risk_too_high');
    }
  }
  conciergeSupport.runtimeFailures.forEach((row) => {
    if (!row || row.status !== 'fail') return;
    const code = row.direction === 'max'
      ? `concierge_runtime_signal_too_high:${row.signal}`
      : `concierge_runtime_signal_too_low:${row.signal}`;
    if (requireStrictRuntimeSignals === true) failures.push(code);
    else warnings.push(code);
  });

  if (!mustPass || mustPass.ok !== true) failures.push('must_pass_fixtures_failed');

  const candidateWarnings = Array.isArray(candidate.hardGate && candidate.hardGate.warnings)
    ? candidate.hardGate.warnings
    : [];
  if (candidateWarnings.length > 0) warnings.push(...candidateWarnings);

  const noRegressionPolicy = {
    mustHold: [
      'factuality_grounding',
      'safety_compliance_privacy',
      'conversation_continuity',
      'repetition_loop_avoidance',
      'japanese_service_quality',
      'line_native_fit',
      'minority_persona_robustness'
    ],
    criticalSlices: criticalSlices.map((row) => row.sliceKey)
  };

  const result = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    baselinePath,
    candidatePath,
    mustPassPath,
    releaseGatePolicy,
    candidateSourceType,
    noRegressionPolicy,
    baselineOverallScore: Number(baseline.overallScore || 0),
    candidateOverallScore: Number(candidate.overallScore || 0),
    keyDimensions,
    criticalSlices,
    softFloorChecks,
    allSlices: allSliceChecks,
    summaryPath,
    runtimeSignals,
    runtimeSignalCoverage,
    conciergeRuntimeSignals: conciergeSupport.runtimeSignals,
    conciergeRuntimeFailures: conciergeSupport.runtimeFailures,
    conciergeCriticalIssues: conciergeSupport.criticalIssues,
    conciergeCriticalIssueCodes: conciergeSupport.criticalIssueCodes,
    conciergeSignalCoverage: conciergeSupport.signalCoverage,
    conciergeCriticalIssueCount: conciergeSupport.criticalIssueCount,
    qualityLoopV2,
    improvementLoop,
    runtimeSummarySource,
    compatGovernance: {
      required: requireCompatGovernance === true,
      maxCompatShare,
      compatShareWindow
    },
    mustPassSummary: {
      ok: mustPass && mustPass.ok === true,
      failureCount: Number(mustPass && mustPass.failureCount ? mustPass.failureCount : 0),
      criticalFailureCount: Number(mustPass && mustPass.criticalFailureCount ? mustPass.criticalFailureCount : 0)
    },
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings))
  };

  writeJson(outPath, result);
  const target = result.ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify(result, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
