'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./lib');
const { FRONTIER_THRESHOLDS } = require('./config');

function num(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function evaluateFrontier(baseline, candidate) {
  const base = baseline && typeof baseline === 'object' ? baseline : {};
  const next = candidate && typeof candidate === 'object' ? candidate : {};

  const qualityDelta = num(next.overallScore, 0) - num(base.overallScore, 0);
  const latencyBase = num(base.frontier && base.frontier.latencyP95Ms, 0);
  const latencyNext = num(next.frontier && next.frontier.latencyP95Ms, 0);
  const costBase = num(base.frontier && base.frontier.costPerTurnUsd, 0);
  const costNext = num(next.frontier && next.frontier.costPerTurnUsd, 0);
  const ackViolation = num(next.frontier && next.frontier.ackSlaViolationRate, 0);

  const latencyRegressionRate = latencyBase > 0 ? (latencyNext - latencyBase) / latencyBase : 0;
  const costRegressionRate = costBase > 0 ? (costNext - costBase) / costBase : 0;

  const warnings = [];
  const failures = [];

  if (qualityDelta < FRONTIER_THRESHOLDS.qualityDeltaWarningBelow && latencyRegressionRate > FRONTIER_THRESHOLDS.latencyRegressionWarnRate) {
    warnings.push('quality_delta_small_with_latency_regression');
  }
  if (qualityDelta <= 0 && costRegressionRate > FRONTIER_THRESHOLDS.costRegressionBlockRate) {
    failures.push('quality_non_improving_with_cost_regression');
  }
  if (ackViolation > FRONTIER_THRESHOLDS.ackSlaViolationBlockRate) {
    failures.push('ack_sla_violation_rate_exceeded');
  }

  return {
    pass: failures.length === 0,
    qualityDelta: Number(qualityDelta.toFixed(4)),
    latencyRegressionRate: Number(latencyRegressionRate.toFixed(4)),
    costRegressionRate: Number(costRegressionRate.toFixed(4)),
    ackSlaViolationRate: Number(ackViolation.toFixed(4)),
    warnings,
    failures
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const baselinePath = args.baseline
    ? path.resolve(process.cwd(), args.baseline)
    : path.join(process.cwd(), 'tmp', 'llm_quality_baseline_scorecard.json');
  const candidatePath = args.candidate
    ? path.resolve(process.cwd(), args.candidate)
    : path.join(process.cwd(), 'tmp', 'llm_quality_candidate_scorecard.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_frontier_eval.json');

  const baseline = readJson(baselinePath);
  const candidate = readJson(candidatePath);
  const result = evaluateFrontier(baseline, candidate);
  writeJson(outPath, result);
  process.stdout.write(`${JSON.stringify({ ok: result.pass, outPath, result }, null, 2)}\n`);
  return result.pass ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  evaluateFrontier,
  main
};
