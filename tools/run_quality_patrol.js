'use strict';

const {
  parsePatrolArgs,
  runQualityPatrolPipeline,
  writeJobArtifacts,
  buildMainArtifact
} = require('./quality_patrol/lib');

async function run(argv, deps) {
  const options = parsePatrolArgs(argv || process.argv);
  const job = await runQualityPatrolPipeline(options, deps);
  const written = writeJobArtifacts(job, options);
  return {
    ok: true,
    outputPath: written.outputs.main,
    outputs: written.outputs,
    artifact: buildMainArtifact(job)
  };
}

async function main() {
  const result = await run(process.argv);
  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    outputPath: result.outputPath,
    outputs: result.outputs,
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
  run
};
