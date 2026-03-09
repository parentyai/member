'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson, buildScorecard } = require('./lib');
const { validateManifest } = require('./benchmark_registry');
const { evaluateRisk } = require('./contamination_guard');
const { summarize } = require('./judge_calibration');
const { evaluateSliceGate } = require('./slice_gate');
const { evaluateFrontier } = require('./frontier_eval');

function toBool(value, fallback) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function main(argv) {
  const args = parseArgs(argv);
  const baselineMetricsPath = args.baseline
    ? path.resolve(process.cwd(), args.baseline)
    : path.join(__dirname, 'fixtures', 'baseline_metrics.v1.json');
  const candidateMetricsPath = args.candidate
    ? path.resolve(process.cwd(), args.candidate)
    : path.join(__dirname, 'fixtures', 'candidate_metrics.v1.json');
  const adjudicationPath = args.adjudication
    ? path.resolve(process.cwd(), args.adjudication)
    : path.join(__dirname, 'fixtures', 'human_adjudication_set.v1.json');
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : path.join(process.cwd(), 'benchmarks', 'registry', 'manifest.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_gate_result.json');

  const baselineMetrics = readJson(baselineMetricsPath);
  const candidateMetrics = readJson(candidateMetricsPath);
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
    contaminationRisk: contamination.overall,
    artifactHash: manifest.artifactHash || null
  });

  const baselineScorecard = buildScorecard(baselineMetrics, { source: baselineMetricsPath });
  const candidateScorecard = buildScorecard(candidateMetrics, { source: candidateMetricsPath });

  const sliceGate = evaluateSliceGate(candidateScorecard);
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
  if (contamination.overall === 'high') warnings.push('contamination_risk_high_registry');
  if (sliceGate.pass !== true) failures.push('slice_gate_failed');
  if (frontier.pass !== true) failures.push('frontier_gate_failed');
  if (candidateScorecard.hardGate.pass !== true) failures.push('quality_hard_gate_failed');
  if (judgeCalibration.reliabilityPolicy.humanReviewRequired === true) failures.push('judge_human_review_required');
  if (Number(replay.criticalFailures || 0) > 0) failures.push('replay_critical_failures');

  warnings.push(...candidateScorecard.hardGate.warnings);
  warnings.push(...sliceGate.warnings);
  warnings.push(...frontier.warnings);

  const result = {
    ok: failures.length === 0,
    generatedAt: new Date().toISOString(),
    baselineMetricsPath,
    candidateMetricsPath,
    adjudicationPath,
    manifestPath,
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
  main
};
