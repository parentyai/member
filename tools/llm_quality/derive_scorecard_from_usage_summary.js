'use strict';

const fs = require('node:fs');
const path = require('node:path');

function parseArgs(argv) {
  const args = Array.isArray(argv) ? argv.slice(2) : [];
  const out = {};
  for (let i = 0; i < args.length; i += 1) {
    const key = args[i];
    if (!key.startsWith('--')) continue;
    const next = args[i + 1];
    out[key.slice(2)] = next && !next.startsWith('--') ? next : true;
    if (next && !next.startsWith('--')) i += 1;
  }
  return out;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, payload) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main(argv) {
  const args = parseArgs(argv);
  const inputPath = args.input
    ? path.resolve(process.cwd(), args.input)
    : path.join(process.cwd(), 'tmp', 'llm_usage_summary.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_runtime_scorecard.json');

  const payload = readJson(inputPath);
  const summary = payload && typeof payload === 'object'
    ? (payload.summary && typeof payload.summary === 'object' ? payload.summary : payload)
    : {};
  const quality = summary && summary.qualityFramework && typeof summary.qualityFramework === 'object'
    ? summary.qualityFramework
    : null;
  if (!quality) {
    process.stderr.write(`${JSON.stringify({ ok: false, error: 'qualityFramework_missing', inputPath }, null, 2)}\n`);
    return 1;
  }
  writeJson(outPath, quality);
  process.stdout.write(`${JSON.stringify({ ok: true, inputPath, outPath, overallScore: quality.overallScore, hardGatePass: quality.hardGate && quality.hardGate.pass === true }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
