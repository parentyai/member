'use strict';

const { writeJson } = require('./llm_quality/lib');
const { parsePatrolArgs, runQualityPatrolPipeline, buildDetectionArtifact } = require('./quality_patrol/lib');

async function run(argv, deps) {
  const options = parsePatrolArgs(argv || process.argv);
  const outputPath = options.detectionOutput || options.output;
  const job = await runQualityPatrolPipeline(options, deps);
  const artifact = buildDetectionArtifact(job);
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
    issueCount: result.artifact.summary.issueCount,
    writeIssues: result.artifact.writeStatus ? result.artifact.writeStatus.executed.issues : false,
    writeBacklog: result.artifact.writeStatus ? result.artifact.writeStatus.executed.backlog : false
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
