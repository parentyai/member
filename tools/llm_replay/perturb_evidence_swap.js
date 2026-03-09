'use strict';

const path = require('node:path');
const fs = require('node:fs');

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

function runPerturbation(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const criticalFailures = [];
  const warningFailures = [];
  list.forEach((row) => {
    const expected = String(row && row.expected ? row.expected : '').toLowerCase();
    const observed = String(row && row.observed ? row.observed : '').toLowerCase();
    if (!expected || !observed || expected === observed) return;
    const type = String(row && row.type ? row.type : 'unknown');
    if (type === 'stale_source' || type === 'contradictory_source' || type === 'evidence_swap') {
      criticalFailures.push({ id: row.id || 'unknown', type, expected, observed });
    } else {
      warningFailures.push({ id: row.id || 'unknown', type, expected, observed });
    }
  });
  return {
    totalCases: list.length,
    criticalFailures: criticalFailures.length,
    warningFailures: warningFailures.length,
    failures: criticalFailures,
    warnings: warningFailures
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const fixturePath = args.fixture
    ? path.resolve(process.cwd(), args.fixture)
    : path.join(__dirname, 'fixtures', 'perturbation_cases.v1.json');
  const outputPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_perturbation_result.json');
  const rows = readJson(fixturePath);
  const result = runPerturbation(rows);
  writeJson(outputPath, result);
  const ok = result.criticalFailures === 0;
  const target = ok ? process.stdout : process.stderr;
  target.write(`${JSON.stringify({ ok, fixturePath, outputPath, result }, null, 2)}\n`);
  return ok ? 0 : 1;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  runPerturbation,
  main
};
