'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./lib');

function evaluateSliceGate(scorecard) {
  const payload = scorecard && typeof scorecard === 'object' ? scorecard : {};
  const slices = Array.isArray(payload.slices) ? payload.slices : [];
  const failures = [];
  const warnings = [];

  slices.forEach((row) => {
    const key = row && typeof row.sliceKey === 'string' ? row.sliceKey : 'unknown';
    const status = row && typeof row.status === 'string' ? row.status : 'warning';
    const critical = row && row.critical === true;
    if (status === 'fail') failures.push(`slice_fail:${key}`);
    if (critical && status !== 'pass') failures.push(`critical_slice_regression:${key}`);
    if (status === 'warning') warnings.push(`slice_warning:${key}`);
  });

  return {
    pass: failures.length === 0,
    failures: Array.from(new Set(failures)),
    warnings: Array.from(new Set(warnings))
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const inputPath = args.input
    ? path.resolve(process.cwd(), args.input)
    : path.join(process.cwd(), 'tmp', 'llm_quality_candidate_scorecard.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_slice_gate.json');
  const scorecard = readJson(inputPath);
  const result = evaluateSliceGate(scorecard);
  writeJson(outPath, result);
  process.stdout.write(`${JSON.stringify({ ok: result.pass, outPath, result }, null, 2)}\n`);
  return result.pass ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  evaluateSliceGate,
  main
};
