'use strict';

const path = require('node:path');
const { parseArgs, readJson, buildScorecard } = require('./lib');
const {
  resolveHarnessRunId,
  resolveRunScopedArtifactGroup,
  writeHarnessArtifact
} = require('./harness_shared');

function main(argv) {
  const args = parseArgs(argv);
  const inputPath = args.input
    ? path.resolve(process.cwd(), args.input)
    : path.join(__dirname, 'fixtures', 'candidate_metrics.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_candidate_scorecard.json');

  const metrics = readJson(inputPath);
  const scorecard = buildScorecard(metrics, { source: inputPath });
  const artifact = writeHarnessArtifact({
    outputPath: outPath,
    value: scorecard,
    runId: resolveHarnessRunId({ env: process.env, sourceTag: 'compute-scorecard' }),
    artifactGroup: resolveRunScopedArtifactGroup('scorecard')
  });
  process.stdout.write(`${JSON.stringify({
    ok: true,
    inputPath,
    outPath: artifact.outputPath,
    runScopedOutPath: artifact.runScopedPath,
    overallScore: scorecard.overallScore,
    hardGate: scorecard.hardGate
  }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
