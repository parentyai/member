'use strict';

const path = require('node:path');
const { parseArgs, writeJson } = require('./llm_quality/lib');
const llmActionLogsRepo = require('../src/repos/firestore/llmActionLogsRepo');
const llmQualityLogsRepo = require('../src/repos/firestore/llmQualityLogsRepo');
const faqAnswerLogsRepo = require('../src/repos/firestore/faqAnswerLogsRepo');
const auditLogsRepo = require('../src/repos/firestore/auditLogsRepo');
const {
  buildGateAuditBaseline,
  buildOptimizationSummary,
  buildConversationQualitySummary,
  buildQualityLoopV2Summary
} = require('../src/routes/admin/osLlmUsageSummary');

const CLARIFY_THRESHOLDS_BY_TIER = Object.freeze({
  high: 0.35,
  medium: 0.45,
  low: 0.55
});

const KPI_THRESHOLDS = Object.freeze({
  contradictionRate: { operator: 'max', value: 0.02 },
  unsupportedClaimRate: { operator: 'max', value: 0.01 },
  evidenceCoverage: { operator: 'min', value: 0.8 },
  officialSourceUsageRate: { operator: 'min', value: 0.95, tier: 'high' },
  fallbackRateByCause: { operator: 'max', value: 0.2, warnAbove: 0.1 },
  compatShareWindow: { operator: 'max', value: 0.15 }
});

function normalizeAuditError(error) {
  if (!error || typeof error !== 'object') {
    return {
      code: 'unknown_error',
      message: error ? String(error) : 'unknown runtime audit error'
    };
  }
  const message = typeof error.message === 'string' && error.message.trim()
    ? error.message.trim()
    : 'unknown runtime audit error';
  const code = typeof error.code === 'string' && error.code.trim()
    ? error.code.trim()
    : (message.includes('invalid_rapt') ? 'invalid_rapt' : 'unknown_error');
  return { code, message };
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return Math.round(num * 10000) / 10000;
}

function normalizeTier(value) {
  const text = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (text === 'high' || text === 'medium' || text === 'low') return text;
  return 'low';
}

function normalizeDecision(row) {
  if (!row || typeof row !== 'object') return 'none';
  const preferred = typeof row.readinessDecisionV2 === 'string' && row.readinessDecisionV2.trim()
    ? row.readinessDecisionV2
    : row.readinessDecision;
  return typeof preferred === 'string' && preferred.trim() ? preferred.trim().toLowerCase() : 'none';
}

function extractAuditSummary(row) {
  return row && row.payloadSummary && typeof row.payloadSummary === 'object' ? row.payloadSummary : {};
}

function latestTimestamp(rows) {
  let latest = null;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const source = row && row.createdAt ? row.createdAt : null;
    let ms = null;
    if (source instanceof Date) ms = source.getTime();
    else if (source && typeof source.toDate === 'function') ms = source.toDate().getTime();
    else if (typeof source === 'string' || typeof source === 'number') {
      const parsed = Date.parse(source);
      if (Number.isFinite(parsed)) ms = parsed;
    }
    if (!Number.isFinite(ms)) return;
    if (latest === null || ms > latest) latest = ms;
  });
  return latest === null ? null : new Date(latest).toISOString();
}

function buildStatus(value, threshold) {
  if (value === null || value === undefined || !threshold) return 'missing';
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 'missing';
  if (threshold.operator === 'min') return numeric >= Number(threshold.value) ? 'pass' : 'fail';
  if (threshold.operator === 'max') {
    if (threshold.warnAbove !== undefined && numeric > Number(threshold.warnAbove) && numeric <= Number(threshold.value)) return 'warning';
    return numeric <= Number(threshold.value) ? 'pass' : 'fail';
  }
  if (threshold.operator === 'exact') return numeric === Number(threshold.value) ? 'pass' : 'fail';
  return 'missing';
}

function buildRateKpi(key, value, sampleCount, threshold, sourceCollections, extras) {
  const numericValue = clamp01(value);
  const status = sampleCount > 0 ? buildStatus(numericValue, threshold) : 'missing';
  return Object.assign({
    value: numericValue,
    sampleCount,
    status,
    threshold,
    sourceCollections: Array.isArray(sourceCollections) ? sourceCollections.slice() : []
  }, extras || {});
}

function buildFallbackKpi(actionRows) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const total = rows.length;
  const byCauseMap = new Map();
  rows.forEach((row) => {
    const value = row && typeof row.fallbackType === 'string' ? row.fallbackType.trim().toLowerCase() : 'none';
    if (!value || value === 'none') return;
    byCauseMap.set(value, (byCauseMap.get(value) || 0) + 1);
  });
  const byCause = Array.from(byCauseMap.entries())
    .map(([cause, count]) => ({
      cause,
      count,
      rate: total > 0 ? Math.round((count / total) * 10000) / 10000 : null
    }))
    .sort((left, right) => right.count - left.count || left.cause.localeCompare(right.cause, 'ja'));
  const peakRate = byCause.length > 0 ? byCause[0].rate : null;
  return buildRateKpi(
    'fallbackRateByCause',
    peakRate,
    total,
    KPI_THRESHOLDS.fallbackRateByCause,
    ['llm_action_logs'],
    { byCause }
  );
}

function buildClarifyRateByTier(actionRows) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const tierRows = ['high', 'medium', 'low'].map((tier) => {
    const scoped = rows.filter((row) => normalizeTier(row && row.intentRiskTier) === tier);
    const clarifyCount = scoped.filter((row) => normalizeDecision(row) === 'clarify').length;
    const value = scoped.length > 0 ? Math.round((clarifyCount / scoped.length) * 10000) / 10000 : null;
    const threshold = { operator: 'max', value: CLARIFY_THRESHOLDS_BY_TIER[tier] };
    return {
      tier,
      value,
      sampleCount: scoped.length,
      status: scoped.length > 0 ? buildStatus(value, threshold) : 'missing',
      threshold
    };
  });
  const populated = tierRows.filter((row) => row.sampleCount > 0 && row.value !== null);
  const overallValue = populated.length > 0
    ? Math.round((populated.reduce((sum, row) => sum + Number(row.value || 0), 0) / populated.length) * 10000) / 10000
    : null;
  const status = tierRows.some((row) => row.status === 'fail')
    ? 'fail'
    : (tierRows.some((row) => row.status === 'warning') ? 'warning' : (tierRows.some((row) => row.status === 'pass') ? 'pass' : 'missing'));
  return {
    value: overallValue,
    sampleCount: rows.length,
    status,
    threshold: {
      operator: 'max_by_tier',
      value: Object.assign({}, CLARIFY_THRESHOLDS_BY_TIER)
    },
    sourceCollections: ['llm_action_logs'],
    byTier: tierRows
  };
}

function buildOfficialSourceUsageRate(actionRows, qualityLoopV2) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const byTier = ['high', 'medium', 'low'].map((tier) => {
    const scoped = rows.filter((row) => normalizeTier(row && row.intentRiskTier) === tier);
    const satisfiedCount = scoped.filter((row) => row && row.officialOnlySatisfied === true).length;
    const value = scoped.length > 0 ? Math.round((satisfiedCount / scoped.length) * 10000) / 10000 : null;
    const threshold = tier === 'high'
      ? KPI_THRESHOLDS.officialSourceUsageRate
      : { operator: 'min', value: 0 };
    return {
      tier,
      value,
      sampleCount: scoped.length,
      status: scoped.length > 0 ? buildStatus(value, threshold) : 'missing',
      threshold
    };
  });
  const present = byTier.filter((row) => row.sampleCount > 0 && row.value !== null);
  const overallValue = present.length > 0
    ? Math.round((present.reduce((sum, row) => sum + Number(row.value || 0), 0) / present.length) * 10000) / 10000
    : null;
  const highRiskMetric = qualityLoopV2 && qualityLoopV2.integrationKpis && qualityLoopV2.integrationKpis.officialSourceUsageRateHighRisk;
  const status = byTier.some((row) => row.tier === 'high' && row.status === 'fail')
    ? 'fail'
    : (present.length > 0 ? 'pass' : 'missing');
  return {
    value: overallValue,
    sampleCount: rows.length,
    status,
    threshold: {
      operator: 'min_high_risk',
      value: KPI_THRESHOLDS.officialSourceUsageRate.value
    },
    sourceCollections: ['llm_action_logs'],
    byTier,
    highRiskMetric: highRiskMetric || null
  };
}

function buildEvidenceCoverage(gateAuditRows) {
  const summaries = (Array.isArray(gateAuditRows) ? gateAuditRows : []).map(extractAuditSummary);
  const values = summaries
    .map((summary) => summary.assistantQuality && Number(summary.assistantQuality.evidenceCoverage))
    .filter((value) => Number.isFinite(value));
  const value = values.length > 0
    ? Math.round((values.reduce((sum, current) => sum + current, 0) / values.length) * 10000) / 10000
    : null;
  return buildRateKpi('evidenceCoverage', value, values.length, KPI_THRESHOLDS.evidenceCoverage, ['llm_gate.decision']);
}

function buildTopFailures(kpis) {
  return Object.entries(kpis)
    .map(([key, value]) => ({
      key,
      status: value && typeof value.status === 'string' ? value.status : 'missing',
      sampleCount: Number(value && value.sampleCount) || 0,
      value: value && Object.prototype.hasOwnProperty.call(value, 'value') ? value.value : null
    }))
    .filter((row) => row.status !== 'pass')
    .sort((left, right) => {
      const priority = { fail: 3, missing: 2, warning: 1, pass: 0 };
      const delta = priority[right.status] - priority[left.status];
      if (delta !== 0) return delta;
      if (left.sampleCount !== right.sampleCount) return left.sampleCount - right.sampleCount;
      return left.key.localeCompare(right.key, 'ja');
    })
    .slice(0, 10);
}

function buildRuntimeAuditReport(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const gateAuditRows = Array.isArray(payload.gateAuditRows) ? payload.gateAuditRows : [];
  const actionRows = Array.isArray(payload.actionRows) ? payload.actionRows : [];
  const qualityRows = Array.isArray(payload.qualityRows) ? payload.qualityRows : [];
  const faqRows = Array.isArray(payload.faqRows) ? payload.faqRows : [];

  const gateAuditBaseline = buildGateAuditBaseline(gateAuditRows);
  const optimization = buildOptimizationSummary(actionRows, gateAuditBaseline);
  const conversation = buildConversationQualitySummary(actionRows);
  const qualityLoopV2 = buildQualityLoopV2Summary({
    actionRows,
    traceSearchAuditRows: [],
    conversationQuality: conversation,
    optimization
  });

  const contradictionCount = actionRows.filter((row) => row && row.contradictionDetected === true).length;
  const unsupportedClaimCount = actionRows.filter((row) => Number(row && row.unsupportedClaimCount) > 0).length;

  const contradictionRate = buildRateKpi(
    'contradictionRate',
    actionRows.length > 0 ? contradictionCount / actionRows.length : null,
    actionRows.length,
    KPI_THRESHOLDS.contradictionRate,
    ['llm_action_logs']
  );
  const unsupportedClaimRate = buildRateKpi(
    'unsupportedClaimRate',
    actionRows.length > 0 ? unsupportedClaimCount / actionRows.length : null,
    actionRows.length,
    KPI_THRESHOLDS.unsupportedClaimRate,
    ['llm_action_logs']
  );
  const evidenceCoverage = buildEvidenceCoverage(gateAuditRows);
  const clarifyRateByTier = buildClarifyRateByTier(actionRows);
  const officialSourceUsageRate = buildOfficialSourceUsageRate(actionRows, qualityLoopV2);
  const fallbackRateByCause = buildFallbackKpi(actionRows);
  const compatShareWindow = buildRateKpi(
    'compatShareWindow',
    optimization.compatShareWindow,
    Number(gateAuditBaseline.callsTotal || 0),
    KPI_THRESHOLDS.compatShareWindow,
    ['llm_gate.decision', 'llm_action_logs']
  );

  const kpis = {
    contradictionRate,
    unsupportedClaimRate,
    evidenceCoverage,
    clarifyRateByTier,
    officialSourceUsageRate,
    fallbackRateByCause,
    compatShareWindow,
    cityPackGroundingRate: Object.assign({ sourceCollections: ['llm_action_logs'] }, qualityLoopV2.integrationKpis.cityPackGroundingRate || {}),
    emergencyOfficialSourceRate: Object.assign({ sourceCollections: ['llm_action_logs'] }, qualityLoopV2.integrationKpis.emergencyOfficialSourceRate || {}),
    journeyAlignedActionRate: Object.assign({ sourceCollections: ['llm_action_logs'] }, qualityLoopV2.integrationKpis.journeyAlignedActionRate || {}),
    savedFaqReusePassRate: Object.assign({ sourceCollections: ['llm_action_logs', 'faq_answer_logs'] }, qualityLoopV2.integrationKpis.savedFaqReusePassRate || {})
  };

  const missingMeasurements = Object.entries(kpis)
    .filter(([, row]) => !row || row.status === 'missing' || Number(row.sampleCount || 0) === 0)
    .map(([key]) => key);

  const releaseBlockerKeys = [
    'contradictionRate',
    'unsupportedClaimRate',
    'evidenceCoverage',
    'officialSourceUsageRate',
    'compatShareWindow',
    'cityPackGroundingRate',
    'emergencyOfficialSourceRate',
    'journeyAlignedActionRate',
    'savedFaqReusePassRate'
  ];
  const releaseBlockers = releaseBlockerKeys.filter((key) => {
    const row = kpis[key];
    return row && (row.status === 'fail' || row.status === 'missing');
  });

  return {
    auditVersion: 'v3',
    generatedAt: new Date().toISOString(),
    window: {
      fromAt: payload.fromAt || null,
      toAt: payload.toAt || null,
      limit: Number.isFinite(Number(payload.limit)) ? Number(payload.limit) : null
    },
    source: {
      latestAuditAt: latestTimestamp([].concat(gateAuditRows, actionRows, qualityRows, faqRows)),
      qualityLogSampleCount: qualityRows.length,
      faqLogSampleCount: faqRows.length,
      runtimeFetchStatus: payload.runtimeFetchStatus || 'ok',
      runtimeFetchErrorCode: payload.runtimeFetchErrorCode || null,
      runtimeFetchErrorMessage: payload.runtimeFetchErrorMessage || null
    },
    kpis,
    topFailures: buildTopFailures(kpis),
    missingMeasurements,
    releaseBlockers: (payload.runtimeFetchStatus === 'unavailable')
      ? Array.from(new Set(['runtimeAuditUnavailable'].concat(releaseBlockers)))
      : releaseBlockers
  };
}

function buildUnavailableAuditReport(options) {
  const payload = options && typeof options === 'object' ? options : {};
  const normalized = normalizeAuditError(payload.error);
  return buildRuntimeAuditReport({
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null,
    limit: payload.limit || null,
    gateAuditRows: [],
    actionRows: [],
    qualityRows: [],
    faqRows: [],
    runtimeFetchStatus: 'unavailable',
    runtimeFetchErrorCode: normalized.code,
    runtimeFetchErrorMessage: normalized.message
  });
}

async function loadRuntimeAuditInputs(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const fromAt = payload.fromAt ? new Date(payload.fromAt) : null;
  const toAt = payload.toAt ? new Date(payload.toAt) : null;
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(5000, Math.floor(Number(payload.limit)))) : 500;

  const [gateAuditRows, actionRows, qualityRows, faqRows] = await Promise.all([
    auditLogsRepo.listAuditLogs({ action: 'llm_gate.decision', limit }),
    llmActionLogsRepo.listLlmActionLogsByCreatedAtRange({ fromAt, toAt, limit }),
    llmQualityLogsRepo.listLlmQualityLogsByCreatedAtRange({ fromAt, toAt, limit }),
    faqAnswerLogsRepo.listFaqAnswerLogs({ sinceAt: fromAt ? fromAt.toISOString() : null, limit })
  ]);

  const fromMs = fromAt instanceof Date && Number.isFinite(fromAt.getTime()) ? fromAt.getTime() : null;
  const toMs = toAt instanceof Date && Number.isFinite(toAt.getTime()) ? toAt.getTime() : null;
  const filteredGateAuditRows = (Array.isArray(gateAuditRows) ? gateAuditRows : []).filter((row) => {
    const summary = row && row.createdAt ? row.createdAt : null;
    const rawMs = summary && typeof summary.toDate === 'function'
      ? summary.toDate().getTime()
      : Date.parse(summary);
    if (!Number.isFinite(rawMs)) return false;
    if (fromMs !== null && rawMs < fromMs) return false;
    if (toMs !== null && rawMs > toMs) return false;
    return true;
  });

  return {
    gateAuditRows: filteredGateAuditRows,
    actionRows,
    qualityRows,
    faqRows
  };
}

async function main(argv) {
  const args = parseArgs(argv);
  const outputPath = path.resolve(process.cwd(), args.output || path.join('tmp', 'quality_audit_report.json'));
  const fromAt = args.fromAt || null;
  const toAt = args.toAt || null;
  const limit = args.limit || 500;
  let report;
  try {
    const inputs = await loadRuntimeAuditInputs({ fromAt, toAt, limit });
    report = buildRuntimeAuditReport(Object.assign({}, inputs, { fromAt, toAt, limit }));
  } catch (error) {
    report = buildUnavailableAuditReport({ fromAt, toAt, limit, error });
  }
  writeJson(outputPath, report);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    degraded: report.source && report.source.runtimeFetchStatus === 'unavailable',
    outputPath,
    releaseBlockerCount: report.releaseBlockers.length
  }, null, 2)}\n`);
  return 0;
}

if (require.main === module) {
  main(process.argv)
    .then((code) => process.exit(code))
    .catch((error) => {
      process.stderr.write(`${error && error.stack ? error.stack : error}\n`);
      process.exit(1);
    });
}

module.exports = {
  CLARIFY_THRESHOLDS_BY_TIER,
  KPI_THRESHOLDS,
  buildRuntimeAuditReport,
  buildUnavailableAuditReport,
  loadRuntimeAuditInputs,
  main
};
