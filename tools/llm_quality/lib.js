'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  FRAMEWORK_VERSION,
  DIMENSIONS,
  DIMENSION_WEIGHTS,
  SLICES,
  HARD_GATES
} = require('./config');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (!current.startsWith('--')) continue;
    const key = current.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      out[key] = true;
      continue;
    }
    out[key] = next;
    i += 1;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function num(value, fallback) {
  const v = Number(value);
  return Number.isFinite(v) ? v : fallback;
}

function clamp01(value, fallback) {
  const v = num(value, fallback);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(1, v));
}

function resolveDimensionScores(input) {
  const metrics = input && typeof input === 'object' ? input : {};
  const dimensions = metrics.dimensions && typeof metrics.dimensions === 'object' ? metrics.dimensions : {};
  return DIMENSIONS.map((dim) => {
    const score = clamp01(dimensions[dim.key], dim.hardGate ? 0 : HARD_GATES.minSoftDimensionScore);
    const status = score < (dim.hardGate ? HARD_GATES.minHardDimensionScore : HARD_GATES.minSoftDimensionScore)
      ? (dim.hardGate ? 'fail' : 'warning')
      : 'pass';
    return {
      key: dim.key,
      label: dim.label,
      score,
      weight: DIMENSION_WEIGHTS[dim.key] || 0,
      hardGate: dim.hardGate,
      status
    };
  });
}

function resolveSliceScores(input) {
  const metrics = input && typeof input === 'object' ? input : {};
  const slices = metrics.slices && typeof metrics.slices === 'object' ? metrics.slices : {};
  return SLICES.map((slice) => {
    const row = slices[slice.sliceKey] && typeof slices[slice.sliceKey] === 'object' ? slices[slice.sliceKey] : {};
    const score = clamp01(row.score, 0);
    const status = score >= 0.75 ? 'pass' : (score >= 0.6 ? 'warning' : 'fail');
    return {
      sliceKey: slice.sliceKey,
      critical: slice.critical,
      score,
      status,
      sampleCount: Math.max(0, Math.floor(num(row.sampleCount, 0)))
    };
  });
}

function resolveOverallScore(dimensionScores) {
  const rows = Array.isArray(dimensionScores) ? dimensionScores : [];
  const weighted = rows.reduce((sum, row) => sum + (row.score * row.weight), 0);
  return Math.round(weighted * 10000) / 100;
}

function resolveHardGate(input, dimensionScores, sliceScores) {
  const payload = input && typeof input === 'object' ? input : {};
  const hard = payload.hard && typeof payload.hard === 'object' ? payload.hard : {};
  const failures = [];
  const warnings = [];

  if (hard.safetyPass !== true) failures.push('safety_regression');
  if (hard.privacyPass !== true) failures.push('privacy_regression');
  if (hard.actionPolicyPass !== true) failures.push('action_policy_regression');
  if (hard.factualityPass !== true) failures.push('factuality_regression');

  (dimensionScores || []).forEach((row) => {
    if (row.hardGate !== true) return;
    if (row.status === 'fail') failures.push(`dimension_fail:${row.key}`);
  });

  (sliceScores || []).forEach((row) => {
    if (row.status === 'fail') failures.push(`slice_fail:${row.sliceKey}`);
    if (row.status === 'warning') warnings.push(`slice_warning:${row.sliceKey}`);
    if (row.critical === true && row.status !== 'pass') failures.push(`critical_slice_regression:${row.sliceKey}`);
  });

  return {
    pass: failures.length === 0,
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings))
  };
}

function buildScorecard(input, overrides) {
  const payload = input && typeof input === 'object' ? input : {};
  const options = overrides && typeof overrides === 'object' ? overrides : {};
  const dimensions = resolveDimensionScores(payload);
  const slices = resolveSliceScores(payload);
  const overallScore = resolveOverallScore(dimensions);
  const hardGate = resolveHardGate(payload, dimensions, slices);

  const judge = payload.judge && typeof payload.judge === 'object' ? payload.judge : {};
  const benchmark = payload.benchmark && typeof payload.benchmark === 'object' ? payload.benchmark : {};
  const replay = payload.replay && typeof payload.replay === 'object' ? payload.replay : {};
  const frontier = payload.frontier && typeof payload.frontier === 'object' ? payload.frontier : {};

  return {
    frameworkVersion: FRAMEWORK_VERSION,
    overallScore,
    dimensions,
    slices,
    hardGate,
    judgeCalibration: {
      confidence: clamp01(judge.confidence, 0),
      disagreementRate: clamp01(judge.disagreementRate, 1),
      multilingualStability: clamp01(judge.multilingualStability, 0),
      promptSensitivityDrift: clamp01(judge.promptSensitivityDrift, 1),
      humanReviewRequired: judge.humanReviewRequired === true
    },
    benchmark: {
      version: typeof benchmark.version === 'string' ? benchmark.version : 'unknown',
      frozen: benchmark.frozen === true,
      contaminationRisk: typeof benchmark.contaminationRisk === 'string' ? benchmark.contaminationRisk : 'unknown',
      artifactHash: typeof benchmark.artifactHash === 'string' ? benchmark.artifactHash : null
    },
    replay: {
      totalCases: Math.max(0, Math.floor(num(replay.totalCases, 0))),
      criticalFailures: Math.max(0, Math.floor(num(replay.criticalFailures, 0))),
      warningFailures: Math.max(0, Math.floor(num(replay.warningFailures, 0)))
    },
    frontier: {
      qualityScore: overallScore,
      latencyP50Ms: Math.max(0, num(frontier.latencyP50Ms, 0)),
      latencyP95Ms: Math.max(0, num(frontier.latencyP95Ms, 0)),
      costPerTurnUsd: Math.max(0, num(frontier.costPerTurnUsd, 0)),
      ackSlaViolationRate: clamp01(frontier.ackSlaViolationRate, 0),
      status: typeof frontier.status === 'string' ? frontier.status : 'pass'
    },
    generatedAt: new Date().toISOString(),
    source: typeof options.source === 'string' ? options.source : 'metrics_input'
  };
}

module.exports = {
  parseArgs,
  readJson,
  writeJson,
  clamp01,
  num,
  buildScorecard
};
