'use strict';

const { writeJson } = require('./llm_quality/lib');
const { parsePatrolArgs, runQualityPatrolPipeline, buildPlanningArtifact } = require('./quality_patrol/lib');

async function run(argv, deps) {
  const options = parsePatrolArgs(argv || process.argv);
  const outputPath = options.planningOutput || options.output;
  const job = await runQualityPatrolPipeline(options, deps);
  const artifact = buildPlanningArtifact(job);
  writeJson(outputPath, artifact);
  return {
    ok: true,
    outputPath,
    artifact
  };
}

async function main() {
  const result = await run(process.argv);
  process.stdout.write(`${JSON.stringify({
    ok: result.ok,
    outputPath: result.outputPath,
    planningStatus: result.artifact.planningStatus,
    proposalCount: Array.isArray(result.artifact.recommendedPr) ? result.artifact.recommendedPr.length : 0
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
