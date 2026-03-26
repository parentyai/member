'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { parseArgs } = require('../llm_quality/lib');
const {
  parsePatrolArgs,
  runQualityPatrolPipeline,
  writeJobArtifacts,
  buildMainArtifact
} = require('./lib');
const { buildConversationReviewUnitsFromDesktopTrace } = require('../../src/usecases/qualityPatrol/buildConversationReviewUnitsFromDesktopTrace');

function readTrace(tracePath) {
  return JSON.parse(fs.readFileSync(tracePath, 'utf8'));
}

function normalizeRunId(trace) {
  return trace && typeof trace.run_id === 'string' && trace.run_id.trim()
    ? trace.run_id.trim()
    : 'desktop_trace';
}

function resolveDefaultOutput(tracePath) {
  const trace = readTrace(tracePath);
  return path.resolve(process.cwd(), 'artifacts', 'line_desktop_patrol', 'evals', normalizeRunId(trace), 'desktop_patrol_eval.json');
}

function parseDesktopPatrolArgs(argv) {
  const args = parseArgs(argv || process.argv);
  const base = parsePatrolArgs(argv || process.argv);
  if (typeof args.trace !== 'string' || !args.trace.trim()) {
    throw new Error('--trace is required');
  }
  const tracePath = path.resolve(process.cwd(), args.trace.trim());
  return Object.assign({}, base, {
    trace: tracePath,
    output: typeof args.output === 'string' && args.output.trim()
      ? path.resolve(process.cwd(), args.output.trim())
      : resolveDefaultOutput(tracePath),
    writeIssues: false,
    writeBacklog: false
  });
}

async function run(argv, deps) {
  const options = parseDesktopPatrolArgs(argv || process.argv);
  const extractor = async () => buildConversationReviewUnitsFromDesktopTrace({ tracePath: options.trace });
  const job = await runQualityPatrolPipeline(options, Object.assign({}, deps, {
    buildConversationReviewUnitsFromSources: extractor,
    listOpenIssues: async () => [],
    listTopPriorityBacklog: async () => []
  }));
  const written = writeJobArtifacts(job, options);
  return {
    ok: true,
    tracePath: options.trace,
    outputPath: written.outputs.main,
    outputs: written.outputs,
    artifact: buildMainArtifact(job)
  };
}

async function main() {
  const result = await run(process.argv);
  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    tracePath: result.tracePath,
    outputPath: result.outputPath,
    outputs: result.outputs,
    reviewUnitCount: result.artifact.reviewUnitCount,
    observationStatus: result.artifact.observationStatus,
    planningStatus: result.artifact.planningStatus,
    analysisStatus: result.artifact.analysisStatus
  }, null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${JSON.stringify({ ok: false, error: error && error.message ? error.message : String(error) }, null, 2)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  parseDesktopPatrolArgs,
  run
};
