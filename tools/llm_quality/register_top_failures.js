'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const { parseArgs, readJson, writeJson } = require('./lib');

const REGISTER_VERSION = 'v1';
const DEFAULT_MAX_HISTORY = 30;
const DEFAULT_LIMIT = 10;

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toRecordList(category, rows, mapper) {
  const list = Array.isArray(rows) ? rows : [];
  return list.map((row, index) => mapper(row, index))
    .filter((row) => row && typeof row === 'object')
    .map((row) => Object.assign({ category }, row));
}

function normalizeEntries(report, limit) {
  const payload = report && typeof report === 'object' ? report : {};
  const max = Math.max(1, Math.floor(toNumber(limit, DEFAULT_LIMIT)));

  const quality = toRecordList('quality_failure', payload.top_10_quality_failures, (row, index) => ({
    rank: index + 1,
    signal: row && row.failure ? String(row.failure) : 'unknown',
    metric: 'hard_gate',
    count: 1,
    severity: 'high'
  }));
  const loops = toRecordList('loop_case', payload.top_10_loop_cases, (row, index) => ({
    rank: index + 1,
    signal: row && row.signal ? String(row.signal) : 'unknown',
    metric: 'loop',
    count: Math.max(0, Math.floor(toNumber(row && row.count, 0))),
    severity: index < 3 ? 'high' : 'medium'
  }));
  const contextLoss = toRecordList('context_loss_case', payload.top_10_context_loss_cases, (row, index) => ({
    rank: index + 1,
    signal: row && row.signal ? String(row.signal) : 'unknown',
    metric: 'context_loss',
    count: Math.max(0, Math.floor(toNumber(row && row.count, 0))),
    severity: index < 3 ? 'high' : 'medium'
  }));
  const jpService = toRecordList('jp_service_failure', payload.top_10_japanese_service_failures, (row, index) => ({
    rank: index + 1,
    signal: row && row.signal ? String(row.signal) : 'unknown',
    metric: 'japanese_service',
    value: Number(toNumber(row && row.value, 0).toFixed(4)),
    severity: index < 3 ? 'high' : 'medium'
  }));
  const lineFit = toRecordList('line_fit_failure', payload.top_10_line_fit_failures, (row, index) => ({
    rank: index + 1,
    signal: row && row.signal ? String(row.signal) : 'unknown',
    metric: 'line_fit',
    value: Number(toNumber(row && row.value, 0).toFixed(4)),
    severity: index < 3 ? 'high' : 'medium'
  }));

  return quality
    .concat(loops, contextLoss, jpService, lineFit)
    .slice(0, max * 5);
}

function buildSnapshot(params) {
  const options = params && typeof params === 'object' ? params : {};
  const report = options.report && typeof options.report === 'object' ? options.report : {};
  const gate = options.gate && typeof options.gate === 'object' ? options.gate : {};
  const limit = options.limit;
  const entries = normalizeEntries(report, limit);

  const generatedAt = typeof report.generatedAt === 'string' && report.generatedAt
    ? report.generatedAt
    : new Date().toISOString();
  const overallQualityScore = Number(toNumber(report.overall_quality_score, 0).toFixed(2));
  const hardGateFailures = Array.isArray(report.hard_gate_failures) ? report.hard_gate_failures.slice(0, 50) : [];
  const gateFailures = Array.isArray(gate.failures) ? gate.failures.slice(0, 50) : [];
  const fingerprintSeed = JSON.stringify({
    generatedAt,
    overallQualityScore,
    hardGateFailures,
    gateFailures,
    entries
  });
  const fingerprint = crypto.createHash('sha256').update(fingerprintSeed).digest('hex');
  return {
    id: `failure_snapshot_${generatedAt}`,
    generatedAt,
    overallQualityScore,
    hardGateFailures,
    gateFailures,
    entryCount: entries.length,
    entries,
    fingerprint
  };
}

function mergeHistory(existing, latest, maxHistory) {
  const current = existing && typeof existing === 'object' ? existing : {};
  const history = Array.isArray(current.history) ? current.history.slice() : [];
  const deduped = history.filter((row) => row && row.fingerprint !== latest.fingerprint);
  deduped.unshift(latest);
  return deduped.slice(0, Math.max(1, Math.floor(toNumber(maxHistory, DEFAULT_MAX_HISTORY))));
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const reportPath = args.report
    ? path.resolve(root, args.report)
    : path.join(root, 'tmp', 'llm_quality_report.json');
  const gatePath = args.gate
    ? path.resolve(root, args.gate)
    : path.join(root, 'tmp', 'llm_quality_gate_result.json');
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_failure_register.json');
  const limit = Math.max(1, Math.floor(toNumber(args.limit, DEFAULT_LIMIT)));
  const maxHistory = Math.max(1, Math.floor(toNumber(args.maxHistory, DEFAULT_MAX_HISTORY)));

  const report = readJson(reportPath);
  const gate = readJson(gatePath);
  const latest = buildSnapshot({ report, gate, limit });

  let existing = null;
  try {
    existing = readJson(outPath);
  } catch (_err) {
    existing = null;
  }
  const history = mergeHistory(existing, latest, maxHistory);
  const register = {
    registerVersion: REGISTER_VERSION,
    updatedAt: new Date().toISOString(),
    source: {
      reportPath,
      gatePath
    },
    policy: {
      maxHistory,
      perCategoryLimit: limit
    },
    latest,
    history
  };
  writeJson(outPath, register);
  process.stdout.write(`${JSON.stringify({ ok: true, outPath, latest }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  normalizeEntries,
  buildSnapshot,
  mergeHistory,
  main
};
