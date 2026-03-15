'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs } = require('../llm_quality/lib');
const { replaySameTrafficSet, DEFAULT_USER_ID } = require('./replay_same_traffic_set');
const { run: runMetrics } = require('../run_quality_patrol_metrics');
const { run: runPatrol } = require('../run_quality_patrol');
const { run: runVerify } = require('./verify_postmerge_runtime_window');

const CYCLE_VERSION = 'quality_patrol_cycle_v1';
const TMP_DIR = '/tmp';
const DEFAULT_PATHS = {
  replay: path.join(TMP_DIR, 'quality_patrol_cycle_replay.json'),
  metrics: path.join(TMP_DIR, 'quality_patrol_cycle_metrics.json'),
  latest: path.join(TMP_DIR, 'quality_patrol_cycle_latest.json'),
  operator: path.join(TMP_DIR, 'quality_patrol_cycle_operator.json'),
  human: path.join(TMP_DIR, 'quality_patrol_cycle_human.json'),
  verify: path.join(TMP_DIR, 'quality_patrol_cycle_verify.json')
};

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseCycleArgs(argv) {
  const args = parseArgs(argv || process.argv);
  return {
    userId: normalizeString(args['user-id'], DEFAULT_USER_ID),
    destination: normalizeString(args.destination, 'debug'),
    prefix: normalizeString(args.prefix, 'quality_patrol_cycle'),
    mergeCommit: normalizeString(args['merge-commit'], null),
    mergeAt: normalizeString(args['merge-at'], null),
    paths: {
      replay: normalizeString(args['replay-output'], DEFAULT_PATHS.replay),
      metrics: normalizeString(args['metrics-output'], DEFAULT_PATHS.metrics),
      latest: normalizeString(args['latest-output'], DEFAULT_PATHS.latest),
      operator: normalizeString(args['operator-output'], DEFAULT_PATHS.operator),
      human: normalizeString(args['human-output'], DEFAULT_PATHS.human),
      verify: normalizeString(args['verify-output'], DEFAULT_PATHS.verify)
    }
  };
}

function resolveGitMergeFacts(options, deps) {
  const payload = options && typeof options === 'object' ? options : {};
  const execGit = deps && typeof deps.execGit === 'function'
    ? deps.execGit
    : (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
  const mergeCommit = normalizeString(payload.mergeCommit, execGit(['rev-parse', 'HEAD']));
  const mergeAt = normalizeString(payload.mergeAt, execGit(['show', '-s', '--format=%cI', mergeCommit]));
  return { mergeCommit, mergeAt };
}

function buildDecisionSummary(verifyArtifact) {
  const payload = verifyArtifact && typeof verifyArtifact === 'object' ? verifyArtifact : {};
  return {
    runtime: normalizeString(payload.currentRuntime && payload.currentRuntime.status, 'unavailable'),
    backlog: normalizeString(payload.historicalDebt && payload.historicalDebt.status, 'unavailable'),
    decision: normalizeString(payload.backlogSeparationGate && payload.backlogSeparationGate.decision, 'UNKNOWN'),
    prD: normalizeString(payload.backlogSeparationGate && payload.backlogSeparationGate.prDStatus, 'unknown')
  };
}

function formatDecisionSummary(summary) {
  const payload = summary && typeof summary === 'object' ? summary : {};
  return [
    'QUALITY PATROL STATUS',
    '',
    `runtime: ${normalizeString(payload.runtime, 'unavailable')}`,
    `backlog: ${normalizeString(payload.backlog, 'unavailable')}`,
    `decision: ${normalizeString(payload.decision, 'UNKNOWN')}`,
    `prD: ${normalizeString(payload.prD, 'unknown')}`
  ].join('\n');
}

function appendGitHubStepSummary(text) {
  const summaryPath = normalizeString(process.env.GITHUB_STEP_SUMMARY, null);
  if (!summaryPath) return;
  fs.appendFileSync(summaryPath, `${text}\n`);
}

async function runQualityPatrolCycle(input, deps) {
  const options = Object.assign({}, parseCycleArgs(['node', 'tools/quality_patrol/run_quality_patrol_cycle.js']), input || {});
  options.paths = Object.assign({}, DEFAULT_PATHS, (input && input.paths) || options.paths || {});
  const resolvedDeps = Object.assign({
    replaySameTrafficSet,
    runMetrics,
    runPatrol,
    runVerify,
    resolveGitMergeFacts
  }, deps || {});

  const mergeFacts = resolvedDeps.resolveGitMergeFacts(options, resolvedDeps);
  const replayResult = await resolvedDeps.replaySameTrafficSet({
    userId: options.userId,
    destination: options.destination,
    prefix: options.prefix,
    output: options.paths.replay
  });

  const metricsResult = await resolvedDeps.runMetrics([
    'node',
    'tools/run_quality_patrol_metrics.js',
    '--output',
    options.paths.metrics
  ]);

  const latestResult = await resolvedDeps.runPatrol([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'latest',
    '--output',
    options.paths.latest
  ]);

  const operatorResult = await resolvedDeps.runPatrol([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'newly-detected-improvements',
    '--output',
    options.paths.operator
  ]);

  const humanResult = await resolvedDeps.runPatrol([
    'node',
    'tools/run_quality_patrol.js',
    '--mode',
    'newly-detected-improvements',
    '--audience',
    'human',
    '--output',
    options.paths.human
  ]);

  const verifyResult = await resolvedDeps.runVerify([
    'node',
    'tools/quality_patrol/verify_postmerge_runtime_window.js',
    '--merge-commit',
    mergeFacts.mergeCommit,
    '--merge-at',
    mergeFacts.mergeAt,
    '--metrics',
    options.paths.metrics,
    '--latest',
    options.paths.latest,
    '--replay',
    options.paths.replay,
    '--output',
    options.paths.verify
  ]);

  const summary = buildDecisionSummary(verifyResult.artifact);
  const summaryText = formatDecisionSummary(summary);
  appendGitHubStepSummary(summaryText);

  return {
    cycleVersion: CYCLE_VERSION,
    checkedAt: new Date().toISOString(),
    mergeCommit: mergeFacts.mergeCommit,
    mergeAt: mergeFacts.mergeAt,
    outputs: Object.assign({}, options.paths),
    replay: replayResult,
    metrics: metricsResult,
    latest: latestResult,
    operator: operatorResult,
    human: humanResult,
    verify: verifyResult,
    summary,
    summaryText
  };
}

async function main() {
  const result = await runQualityPatrolCycle(parseCycleArgs(process.argv));
  process.stdout.write(`${result.summaryText}\n\n`);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    cycleVersion: result.cycleVersion,
    mergeCommit: result.mergeCommit,
    mergeAt: result.mergeAt,
    outputs: result.outputs,
    windowEndsAfterMerge: result.verify.artifact.windowEndsAfterMerge,
    recentWrittenAtLeast5: result.verify.artifact.recentWrittenAtLeast5,
    decision: result.summary.decision,
    prDStatus: result.summary.prD
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      ok: false,
      code: normalizeString(error && error.code, 'quality_patrol_cycle_failed'),
      error: normalizeString(error && error.message, String(error))
    }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CYCLE_VERSION,
  DEFAULT_PATHS,
  parseCycleArgs,
  resolveGitMergeFacts,
  buildDecisionSummary,
  formatDecisionSummary,
  runQualityPatrolCycle
};
