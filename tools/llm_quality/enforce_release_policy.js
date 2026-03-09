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

  const baseline = readJson(baselinePath);
  const candidate = readJson(candidatePath);
  const mustPass = readJson(mustPassPath);

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
    mustPassFixturesRequired: true
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
