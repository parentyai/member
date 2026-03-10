'use strict';

const fs = require('node:fs');
const path = require('node:path');

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
      return payload.summary;
    }
    return payload && typeof payload === 'object' ? payload : null;
  } catch (_err) {
    return null;
  }
}

function readFiniteNumber(obj, key) {
  if (!obj || typeof obj !== 'object') return null;
  if (!Object.prototype.hasOwnProperty.call(obj, key)) return null;
  const value = Number(obj[key]);
  return Number.isFinite(value) ? value : null;
}

const STRICT_RUNTIME_SIGNAL_KEYS = Object.freeze([
  'legacyTemplateHitRate',
  'defaultCasualRate',
  'followupQuestionIncludedRate',
  'conciseModeAppliedRate',
  'retrieveNeededRate',
  'avgActionCount',
  'directAnswerAppliedRate',
  'avgRepeatRiskScore'
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
  const candidate = readJson(candidatePath);
  const mustPass = readJson(mustPassPath);
  const summary = readSummaryData(summaryPath);

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
      avgRepeatRiskScore: runtimeSignalRaw.avgRepeatRiskScore
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
