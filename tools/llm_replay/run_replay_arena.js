'use strict';

const path = require('node:path');
const fs = require('node:fs');
const { runReplay } = require('./trace_replayer');
const { runPerturbation } = require('./perturb_evidence_swap');

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const outIndex = args.indexOf('--output');
  const outputPath = outIndex >= 0 && args[outIndex + 1]
    ? path.resolve(process.cwd(), args[outIndex + 1])
    : path.join(process.cwd(), 'tmp', 'llm_replay_arena_result.json');

  const replayRows = require(path.join(__dirname, 'fixtures', 'trace_replay_cases.v1.json'));
  const perturbRows = require(path.join(__dirname, 'fixtures', 'perturbation_cases.v1.json'));

  const replay = runReplay(replayRows);
  const perturbation = runPerturbation(perturbRows);

  const result = {
    ok: replay.criticalFailures === 0 && perturbation.criticalFailures === 0,
    replay,
    perturbation,
    totals: {
      totalCases: replay.totalCases + perturbation.totalCases,
      criticalFailures: replay.criticalFailures + perturbation.criticalFailures,
      warningFailures: replay.warningFailures + perturbation.warningFailures
    }
  };

  writeJson(outputPath, result);
  const target = result.ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify({ ok: result.ok, outputPath, result }, null, 2)}\n`);
  return result.ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
