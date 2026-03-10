'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson } = require('./lib');

function evaluateRisk(manifest) {
  const payload = manifest && typeof manifest === 'object' ? manifest : {};
  const fixtures = Array.isArray(payload.fixtures) ? payload.fixtures : [];
  const counts = { low: 0, medium: 0, high: 0, unknown: 0 };
  const hardGateCounts = { low: 0, medium: 0, high: 0, unknown: 0 };
  const eligibleFixtures = [];
  const excludedFixtures = [];
  fixtures.forEach((fixture) => {
    const risk = fixture && typeof fixture.contaminationRisk === 'string'
      ? fixture.contaminationRisk.trim().toLowerCase()
      : 'unknown';
    if (Object.prototype.hasOwnProperty.call(counts, risk)) counts[risk] += 1;
    else counts.unknown += 1;
    const id = fixture && typeof fixture.id === 'string' ? fixture.id : null;
    const isHighRisk = risk === 'high';
    if (isHighRisk) {
      excludedFixtures.push({ id, risk });
      return;
    }
    eligibleFixtures.push({ id, risk });
    if (Object.prototype.hasOwnProperty.call(hardGateCounts, risk)) hardGateCounts[risk] += 1;
    else hardGateCounts.unknown += 1;
  });
  const overall = counts.high > 0 ? 'high' : (counts.medium > 0 ? 'medium' : 'low');
  const hardGateOverall = hardGateCounts.high > 0
    ? 'high'
    : (hardGateCounts.medium > 0 ? 'medium' : 'low');
  return {
    overall,
    counts,
    hardGateOverall,
    hardGateCounts,
    hardGateEligibleFixtureIds: eligibleFixtures
      .filter((fixture) => typeof fixture.id === 'string')
      .map((fixture) => fixture.id),
    excludedFixtureIds: excludedFixtures
      .filter((fixture) => typeof fixture.id === 'string')
      .map((fixture) => fixture.id)
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const manifestPath = args.manifest
    ? path.resolve(process.cwd(), args.manifest)
    : path.join(process.cwd(), 'benchmarks', 'registry', 'manifest.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_contamination_guard.json');
  const manifest = readJson(manifestPath);
  const summary = evaluateRisk(manifest);
  writeJson(outPath, summary);
  process.stdout.write(`${JSON.stringify({ ok: true, outPath, summary }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  evaluateRisk,
  main
};
