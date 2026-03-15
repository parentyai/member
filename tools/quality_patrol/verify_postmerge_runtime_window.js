'use strict';

const os = require('node:os');
const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('../llm_quality/lib');

const VERIFY_VERSION = 'quality_patrol_postmerge_verify_v1';
const DEFAULT_OUTPUT_PATH = path.join(os.tmpdir(), 'quality_patrol_postmerge_verify.json');

function normalizeString(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function parseVerifyArgs(argv) {
  const args = parseArgs(argv || process.argv);
  return {
    mergeCommit: normalizeString(args['merge-commit'], null),
    mergeAt: normalizeString(args['merge-at'], null),
    metricsPath: normalizeString(args.metrics, null),
    latestPath: normalizeString(args.latest, null),
    replayPath: normalizeString(args.replay, null),
    output: normalizeString(args.output, DEFAULT_OUTPUT_PATH)
  };
}

function toEpochMs(value) {
  const epoch = Date.parse(value || '');
  return Number.isFinite(epoch) ? epoch : null;
}

function pickBacklogSeparation(latestArtifact, metricsArtifact) {
  if (latestArtifact && latestArtifact.backlogSeparation) return latestArtifact.backlogSeparation;
  if (metricsArtifact && metricsArtifact.backlogSeparation) return metricsArtifact.backlogSeparation;
  return {};
}

function pickRecentWindow(latestArtifact, metricsArtifact) {
  return (latestArtifact && latestArtifact.decayAwareReadiness && latestArtifact.decayAwareReadiness.recentWindow)
    || (metricsArtifact && metricsArtifact.decayAwareReadiness && metricsArtifact.decayAwareReadiness.recentWindow)
    || null;
}

function pickFullWindow(latestArtifact, metricsArtifact) {
  return (latestArtifact && latestArtifact.decayAwareReadiness && latestArtifact.decayAwareReadiness.fullWindow)
    || (metricsArtifact && metricsArtifact.decayAwareReadiness && metricsArtifact.decayAwareReadiness.fullWindow)
    || null;
}

function buildPostmergeRuntimeWindowVerification(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const latestArtifact = payload.latestArtifact && typeof payload.latestArtifact === 'object' ? payload.latestArtifact : {};
  const metricsArtifact = payload.metricsArtifact && typeof payload.metricsArtifact === 'object' ? payload.metricsArtifact : {};
  const replayArtifact = payload.replayArtifact && typeof payload.replayArtifact === 'object' ? payload.replayArtifact : {};
  const backlogSeparation = pickBacklogSeparation(latestArtifact, metricsArtifact);
  const currentRuntime = backlogSeparation.currentRuntime || null;
  const historicalDebt = backlogSeparation.historicalDebt || null;
  const backlogSeparationGate = backlogSeparation.backlogSeparationGate || null;
  const recentWindow = pickRecentWindow(latestArtifact, metricsArtifact);
  const fullWindow = pickFullWindow(latestArtifact, metricsArtifact);
  const mergeAt = normalizeString(payload.mergeAt, null);
  const currentRuntimeWindowToAt = currentRuntime && currentRuntime.window ? normalizeString(currentRuntime.window.toAt, null) : null;
  const windowEndsAfterMerge = Boolean(
    mergeAt
    && currentRuntimeWindowToAt
    && toEpochMs(currentRuntimeWindowToAt) !== null
    && toEpochMs(mergeAt) !== null
    && toEpochMs(currentRuntimeWindowToAt) > toEpochMs(mergeAt)
  );
  const recentWritten = recentWindow && Number.isFinite(Number(recentWindow.written)) ? Number(recentWindow.written) : 0;
  const recentWrittenAtLeast5 = recentWritten >= 5;
  return {
    verificationVersion: VERIFY_VERSION,
    checkedAt: new Date().toISOString(),
    mergeCommit: normalizeString(payload.mergeCommit, null),
    mergeAt,
    recentWindow,
    fullWindow,
    currentRuntime,
    historicalDebt,
    backlogSeparationGate,
    windowEndsAfterMerge,
    recentWrittenAtLeast5,
    replaySummary: replayArtifact && typeof replayArtifact === 'object'
      ? {
        replayVersion: normalizeString(replayArtifact.replayVersion, null),
        replayCount: Number.isFinite(Number(replayArtifact.replayCount)) ? Number(replayArtifact.replayCount) : 0,
        requestIds: Array.isArray(replayArtifact.events)
          ? replayArtifact.events.map((row) => row && row.requestId).filter(Boolean)
          : []
      }
      : null
  };
}

async function run(argv) {
  const options = parseVerifyArgs(argv || process.argv);
  const latestArtifact = options.latestPath ? readJson(options.latestPath) : {};
  const metricsArtifact = options.metricsPath ? readJson(options.metricsPath) : {};
  const replayArtifact = options.replayPath ? readJson(options.replayPath) : {};
  const result = buildPostmergeRuntimeWindowVerification({
    mergeCommit: options.mergeCommit,
    mergeAt: options.mergeAt,
    latestArtifact,
    metricsArtifact,
    replayArtifact
  });
  writeJson(options.output, result);
  return {
    outputPath: options.output,
    artifact: result
  };
}

async function main() {
  const result = await run(process.argv);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    outputPath: result.outputPath,
    windowEndsAfterMerge: result.artifact.windowEndsAfterMerge,
    recentWrittenAtLeast5: result.artifact.recentWrittenAtLeast5,
    decision: result.artifact.backlogSeparationGate ? result.artifact.backlogSeparationGate.decision : null,
    prDStatus: result.artifact.backlogSeparationGate ? result.artifact.backlogSeparationGate.prDStatus : null
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error && error.message ? error.message : String(error) }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  VERIFY_VERSION,
  parseVerifyArgs,
  buildPostmergeRuntimeWindowVerification,
  run
};
