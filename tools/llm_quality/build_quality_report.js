'use strict';

const fs = require('node:fs');
const path = require('node:path');
const {
  buildConciergeReleaseSupport,
  buildConciergeRuntimeFailures: buildConciergeRuntimeFailuresFromSupport,
  CONCIERGE_RUNTIME_SIGNAL_KEYS
} = require('./concierge_quality');

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

function toMap(rows, keyField) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = typeof row[keyField] === 'string' ? row[keyField].trim() : '';
    if (!key) return;
    map.set(key, row);
  });
  return map;
}

function sortByCount(rows, keyField, countField, limit) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      key: row && row[keyField] ? String(row[keyField]) : 'unknown',
      count: Number.isFinite(Number(row && row[countField])) ? Number(row[countField]) : 0
    }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key, 'ja'))
    .slice(0, limit);
}

function buildTopQualityFailures(candidate) {
  const failures = Array.isArray(candidate && candidate.hardGate && candidate.hardGate.failures)
    ? candidate.hardGate.failures
    : [];
  return failures.slice(0, 10).map((item, index) => ({
    rank: index + 1,
    failure: item
  }));
}

function buildSoftFloorGaps(candidate, floor) {
  const threshold = Number.isFinite(Number(floor)) ? Number(floor) : 0.8;
  const rows = Array.isArray(candidate && candidate.dimensions) ? candidate.dimensions : [];
  return rows
    .filter((row) => row && typeof row.key === 'string' && row.hardGate !== true)
    .map((row) => ({
      key: row.key,
      score: Number(row.score || 0),
      gap: Number((threshold - Number(row.score || 0)).toFixed(4))
    }))
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.key.localeCompare(b.key, 'ja'))
    .slice(0, 10);
}

function buildLoopCases(summary) {
  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  const rows = [];
  const routerReasons = sortByCount(conversation.routerReasons, 'routerReason', 'count', 10);
  routerReasons.forEach((row) => {
    if (!String(row.key).includes('default_casual')) return;
    rows.push({
      signal: `routerReason:${row.key}`,
      count: row.count
    });
  });
  const fallbackTypes = sortByCount(conversation.fallbackTypes, 'fallbackType', 'count', 10);
  fallbackTypes.forEach((row) => {
    rows.push({
      signal: `fallbackType:${row.key}`,
      count: row.count
    });
  });
  return rows
    .sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal, 'ja'))
    .slice(0, 10);
}

function buildContextLossCases(summary) {
  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  const followupIntents = sortByCount(conversation.followupIntents, 'followupIntent', 'count', 10);
  const domainIntents = sortByCount(conversation.domainIntents, 'domainIntent', 'count', 10);
  return followupIntents.concat(domainIntents)
    .map((row) => ({
      signal: row.key,
      count: row.count
    }))
    .sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal, 'ja'))
    .slice(0, 10);
}

function buildJapaneseServiceFailures(summary) {
  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  const toValue = (signal, compute) => {
    if (!Object.prototype.hasOwnProperty.call(conversation, signal)) {
      return null;
    }
    const raw = Number(conversation[signal]);
    if (!Number.isFinite(raw)) {
      return null;
    }
    const value = Number.isFinite(Number(compute(raw))) ? Number(compute(raw)) : 0;
    return {
      signal,
      value: Number(value.toFixed(4)),
      available: true
    };
  };
  return [
    toValue('legacyTemplateHitRate', (v) => v),
    toValue('defaultCasualRate', (v) => v),
    toValue('followupQuestionIncludedRate', (v) => 1 - v),
    toValue('conciseModeAppliedRate', (v) => 1 - v)
  ]
    .filter(Boolean)
    .sort((a, b) => b.value - a.value || a.signal.localeCompare(b.signal, 'ja'))
    .slice(0, 10);
}

function buildLineFitFailures(summary) {
  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  const toValue = (signal, compute) => {
    if (!Object.prototype.hasOwnProperty.call(conversation, signal)) {
      return null;
    }
    const raw = Number(conversation[signal]);
    if (!Number.isFinite(raw)) {
      return null;
    }
    const value = Number.isFinite(Number(compute(raw))) ? Number(compute(raw)) : 0;
    return {
      signal,
      value: Number(value.toFixed(4)),
      available: true
    };
  };
  return [
    toValue('retrieveNeededRate', (v) => v),
    toValue('defaultCasualRate', (v) => v),
    toValue('avgActionCount', (v) => Math.max(0, v - 3))
  ]
    .filter(Boolean)
    .map((row) => ({
      signal: row.signal === 'avgActionCount' ? 'avgActionCountOverBudget' : row.signal,
      value: row.value,
      available: row.available
    }))
    .sort((a, b) => b.value - a.value || a.signal.localeCompare(b.signal, 'ja'))
    .slice(0, 10);
}

function buildConciergeRuntimeFailures(summary) {
  return buildConciergeRuntimeFailuresFromSupport(summary).map((row) => ({
    signal: row.signal,
    value: row.value,
    threshold: row.threshold,
    available: row.available,
    direction: row.direction
  }));
}

function buildSignalCoverage(summary) {
  const conversation = summary && summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  const requiredSignals = [
    'legacyTemplateHitRate',
    'defaultCasualRate',
    'followupQuestionIncludedRate',
    'conciseModeAppliedRate',
    'retrieveNeededRate',
    'avgActionCount',
    'directAnswerAppliedRate',
    'avgRepeatRiskScore',
    ...CONCIERGE_RUNTIME_SIGNAL_KEYS
  ];
  const missingSignals = requiredSignals.filter((key) => {
    if (!Object.prototype.hasOwnProperty.call(conversation, key)) {
      return true;
    }
    return !Number.isFinite(Number(conversation[key]));
  });
  return {
    conversationQualityPresent: Object.keys(conversation).length > 0,
    requiredSignalCount: requiredSignals.length,
    availableSignalCount: requiredSignals.length - missingSignals.length,
    missingSignalCount: missingSignals.length,
    missingSignals
  };
}

function main(argv) {
  const args = parseArgs(argv);
  const root = process.cwd();
  const baselinePath = args.baseline
    ? path.resolve(root, args.baseline)
    : path.join(root, 'tmp', 'llm_quality_baseline_scorecard.json');
  const candidatePath = args.candidate
    ? path.resolve(root, args.candidate)
    : path.join(root, 'tmp', 'llm_quality_candidate_scorecard.json');
  const summaryPath = args.summary
    ? path.resolve(root, args.summary)
    : null;
  const outPath = args.output
    ? path.resolve(root, args.output)
    : path.join(root, 'tmp', 'llm_quality_report.json');

  const baseline = readJson(baselinePath);
  const candidate = readJson(candidatePath);
  const summaryPayload = summaryPath ? readJson(summaryPath) : null;
  const summary = summaryPayload && typeof summaryPayload === 'object'
    ? (summaryPayload.summary && typeof summaryPayload.summary === 'object' ? summaryPayload.summary : summaryPayload)
    : {};
  const conciergeSupport = buildConciergeReleaseSupport(summary);

  const baselineDimensions = toMap(baseline.dimensions, 'key');
  const candidateDimensions = toMap(candidate.dimensions, 'key');
  const dimensionScores = Array.from(candidateDimensions.entries()).map(([key, row]) => {
    const before = baselineDimensions.get(key) || {};
    return {
      key,
      baseline: Number(before.score || 0),
      candidate: Number(row.score || 0),
      delta: Number((Number(row.score || 0) - Number(before.score || 0)).toFixed(4)),
      status: row.status || 'unknown'
    };
  }).sort((a, b) => a.key.localeCompare(b.key, 'ja'));

  const report = {
    generatedAt: new Date().toISOString(),
    overall_quality_score: Number(candidate.overallScore || 0),
    baseline_overall_quality_score: Number(baseline.overallScore || 0),
    dimension_scores: dimensionScores,
    hard_gate_failures: Array.isArray(candidate.hardGate && candidate.hardGate.failures)
      ? candidate.hardGate.failures
      : [],
    top_10_quality_failures: buildTopQualityFailures(candidate),
    soft_floor_threshold: 0.8,
    soft_floor_gaps: buildSoftFloorGaps(candidate, 0.8),
    top_10_loop_cases: buildLoopCases(summary),
    top_10_context_loss_cases: buildContextLossCases(summary),
    top_10_japanese_service_failures: buildJapaneseServiceFailures(summary),
    top_10_line_fit_failures: buildLineFitFailures(summary),
    top_10_concierge_runtime_failures: buildConciergeRuntimeFailures(summary),
    signal_coverage: buildSignalCoverage(summary),
    concierge_runtime_signals: conciergeSupport.runtimeSignals,
    concierge_signal_coverage: conciergeSupport.signalCoverage,
    critical_unresolved_issues: conciergeSupport.criticalIssues,
    critical_unresolved_issue_codes: conciergeSupport.criticalIssueCodes,
    critical_unresolved_issue_count: conciergeSupport.criticalIssueCount,
    current_quality_risk_map: {
      high: dimensionScores.filter((row) => row.status === 'fail').slice(0, 10),
      medium: dimensionScores.filter((row) => row.status === 'warning').slice(0, 10),
      low: dimensionScores.filter((row) => row.status === 'pass').slice(0, 10)
    }
  };

  writeJson(outPath, report);
  process.stdout.write(`${JSON.stringify({ ok: true, outPath, report }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  process.exit(main(process.argv));
}

module.exports = {
  main
};
