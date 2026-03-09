'use strict';

const path = require('node:path');
const { parseArgs, readJson, writeJson, clamp01 } = require('./lib');
const { JUDGE_RELIABILITY_POLICY } = require('./config');

function normalizeDecision(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!text) return 'unknown';
  return text;
}

function computePromptSensitivity(row) {
  const alt = Array.isArray(row && row.altPromptDecisions) ? row.altPromptDecisions : [];
  if (!alt.length) return 0;
  const uniq = new Set(alt.map(normalizeDecision));
  return uniq.size > 1 ? 1 : 0;
}

function summarize(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let disagree = 0;
  let sensitivityCount = 0;
  let confidenceTotal = 0;
  let confidenceCount = 0;

  let jpTotal = 0;
  let jpDisagree = 0;
  let jpEnTotal = 0;
  let jpEnDisagree = 0;

  list.forEach((row) => {
    const judge = normalizeDecision(row && row.judgeDecision);
    const human = normalizeDecision(row && row.humanDecision);
    const language = normalizeDecision(row && row.language);
    if (judge !== human) disagree += 1;
    const sensitivity = computePromptSensitivity(row);
    sensitivityCount += sensitivity;
    const confidence = clamp01(row && row.confidence, null);
    if (Number.isFinite(confidence)) {
      confidenceTotal += confidence;
      confidenceCount += 1;
    }

    if (language === 'jp') {
      jpTotal += 1;
      if (judge !== human) jpDisagree += 1;
    } else if (language === 'jp_en_terms') {
      jpEnTotal += 1;
      if (judge !== human) jpEnDisagree += 1;
    }
  });

  const sampleCount = list.length;
  const disagreementRate = sampleCount > 0 ? Number((disagree / sampleCount).toFixed(4)) : 0;
  const promptSensitivityDrift = sampleCount > 0 ? Number((sensitivityCount / sampleCount).toFixed(4)) : 0;
  const confidence = confidenceCount > 0 ? Number((confidenceTotal / confidenceCount).toFixed(4)) : 0;

  const jpRate = jpTotal > 0 ? jpDisagree / jpTotal : 0;
  const jpEnRate = jpEnTotal > 0 ? jpEnDisagree / jpEnTotal : 0;
  const multilingualStability = Number((1 - Math.abs(jpRate - jpEnRate)).toFixed(4));

  const humanReviewRequired = disagreementRate > JUDGE_RELIABILITY_POLICY.maxDisagreementRate
    || promptSensitivityDrift > JUDGE_RELIABILITY_POLICY.maxSensitivityDrift;

  return {
    sampleCount,
    disagreementCount: disagree,
    disagreementRate,
    promptSensitivityDrift,
    confidence,
    multilingualStability,
    reliabilityPolicy: {
      maxDisagreementRate: JUDGE_RELIABILITY_POLICY.maxDisagreementRate,
      maxSensitivityDrift: JUDGE_RELIABILITY_POLICY.maxSensitivityDrift,
      humanReviewRequiredNearHardGate: JUDGE_RELIABILITY_POLICY.humanReviewRequiredNearHardGate,
      humanReviewRequired
    }
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const inputPath = args.input
    ? path.resolve(process.cwd(), args.input)
    : path.join(__dirname, 'fixtures', 'human_adjudication_set.v1.json');
  const outPath = args.output
    ? path.resolve(process.cwd(), args.output)
    : path.join(process.cwd(), 'tmp', 'llm_quality_judge_calibration.json');

  const rows = readJson(inputPath);
  const summary = summarize(rows);
  writeJson(outPath, summary);
  process.stdout.write(`${JSON.stringify({ ok: true, inputPath, outPath, summary }, null, 2)}\n`);
  return summary.reliabilityPolicy.humanReviewRequired ? 2 : 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  summarize,
  main
};
