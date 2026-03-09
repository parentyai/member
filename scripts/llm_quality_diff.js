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

function toMap(rows, key) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const k = typeof row[key] === 'string' ? row[key].trim() : '';
    if (!k) return;
    map.set(k, row);
  });
  return map;
}

function main(argv) {
  const args = parseArgs(argv);
  const baselinePath = args.baseline ? path.resolve(process.cwd(), args.baseline) : path.join(process.cwd(), 'tmp', 'llm_quality_baseline_scorecard.json');
  const candidatePath = args.candidate ? path.resolve(process.cwd(), args.candidate) : path.join(process.cwd(), 'tmp', 'llm_quality_candidate_scorecard.json');
  const outputPath = args.output ? path.resolve(process.cwd(), args.output) : path.join(process.cwd(), 'tmp', 'llm_quality_diff.json');

  const baseline = readJson(baselinePath);
  const candidate = readJson(candidatePath);

  const baselineDimensions = toMap(baseline.dimensions, 'key');
  const candidateDimensions = toMap(candidate.dimensions, 'key');
  const baselineSlices = toMap(baseline.slices, 'sliceKey');
  const candidateSlices = toMap(candidate.slices, 'sliceKey');

  const dimensionDiff = Array.from(candidateDimensions.keys()).map((key) => {
    const current = candidateDimensions.get(key) || {};
    const prev = baselineDimensions.get(key) || {};
    const prevScore = Number(prev.score || 0);
    const nextScore = Number(current.score || 0);
    return {
      key,
      baseline: prevScore,
      candidate: nextScore,
      delta: Number((nextScore - prevScore).toFixed(4))
    };
  }).sort((a, b) => a.key.localeCompare(b.key, 'ja'));

  const sliceDiff = Array.from(candidateSlices.keys()).map((sliceKey) => {
    const current = candidateSlices.get(sliceKey) || {};
    const prev = baselineSlices.get(sliceKey) || {};
    const prevScore = Number(prev.score || 0);
    const nextScore = Number(current.score || 0);
    return {
      sliceKey,
      baseline: prevScore,
      candidate: nextScore,
      delta: Number((nextScore - prevScore).toFixed(4)),
      baselineStatus: prev.status || 'unknown',
      candidateStatus: current.status || 'unknown'
    };
  }).sort((a, b) => a.sliceKey.localeCompare(b.sliceKey, 'ja'));

  const result = {
    generatedAt: new Date().toISOString(),
    overall: {
      baseline: Number(baseline.overallScore || 0),
      candidate: Number(candidate.overallScore || 0),
      delta: Number(((Number(candidate.overallScore || 0)) - (Number(baseline.overallScore || 0))).toFixed(4))
    },
    hardGate: {
      baselinePass: baseline.hardGate && baseline.hardGate.pass === true,
      candidatePass: candidate.hardGate && candidate.hardGate.pass === true,
      candidateFailures: Array.isArray(candidate.hardGate && candidate.hardGate.failures) ? candidate.hardGate.failures : []
    },
    dimensionDiff,
    sliceDiff
  };

  writeJson(outputPath, result);
  process.stdout.write(`${JSON.stringify({ ok: true, outputPath, result }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
