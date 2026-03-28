'use strict';

const path = require('node:path');
const { parseArgs, readJson } = require('./lib');
const {
  resolveHarnessRunId,
  resolveRunScopedArtifactGroup,
  writeHarnessArtifact
} = require('./harness_shared');
const {
  classifyCounterexampleSignal,
  buildCounterexampleQueueFromSignalEntries
} = require('../../src/domain/llm/quality/counterexampleQueue');

const DEFAULT_LIMIT = 30;

function classifyCounterexample(entry) {
  return classifyCounterexampleSignal(entry);
}

function buildQueue(registerPayload, limit) {
  const register = registerPayload && typeof registerPayload === 'object' ? registerPayload : {};
  const latest = register.latest && typeof register.latest === 'object' ? register.latest : {};
  const entries = Array.isArray(latest.entries) ? latest.entries : [];
  const max = Math.max(1, Math.floor(Number(limit) || DEFAULT_LIMIT));
  return buildCounterexampleQueueFromSignalEntries(entries, { limit: max });
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const registerPath = args.register
    ? path.resolve(root, args.register)
    : path.join(root, 'tmp', 'llm_quality_failure_register.json');
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_counterexample_queue.json');
  const limit = Math.max(1, Math.floor(Number(args.limit) || DEFAULT_LIMIT));

  const register = readJson(registerPath);
  const queue = buildQueue(register, limit);
  const payload = {
    generatedAt: new Date().toISOString(),
    source: registerPath,
    latestFailureSnapshotId: register && register.latest ? register.latest.id : null,
    queue
  };
  const artifact = writeHarnessArtifact({
    outputPath: outPath,
    value: payload,
    runId: resolveHarnessRunId({ env: process.env, sourceTag: 'counterexample-queue' }),
    artifactGroup: resolveRunScopedArtifactGroup('queue')
  });
  process.stdout.write(`${JSON.stringify({ ok: true, outPath: artifact.outputPath, runScopedOutPath: artifact.runScopedPath, queueSize: queue.length }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  classifyCounterexample,
  buildQueue,
  main
};
