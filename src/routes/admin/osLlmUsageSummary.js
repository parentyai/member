'use strict';

const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');

function parsePositiveInt(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isInteger(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function parseRate(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 1) return null;
  return Math.round(num * 10000) / 10000;
}

const DEFAULT_RELEASE_READINESS_THRESHOLDS = Object.freeze({
  minSampleCount: 20,
  minAcceptedRate: 0.7,
  maxCitationMissingRate: 0.25,
  maxTemplateViolationRate: 0.2,
  maxFallbackRate: 0.35,
  minEvidenceCoverage: 0.8
});
const DASHBOARD_ENTRY_TYPES = Object.freeze(['webhook', 'admin', 'compat', 'job']);
const DASHBOARD_GATES = Object.freeze(['kill_switch', 'url_guard', 'injection', 'snapshot']);

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function toDateKey(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function sumBy(array, selector) {
  return (Array.isArray(array) ? array : []).reduce((sum, row) => {
    const value = Number(selector(row));
    if (!Number.isFinite(value)) return sum;
    return sum + value;
  }, 0);
}

function normalizeReason(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text || 'none';
}

function maskLineUserId(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return '';
  if (text.length <= 6) return `${text.slice(0, 1)}***${text.slice(-1)}`;
  return `${text.slice(0, 3)}***${text.slice(-2)}`;
}

function buildDailySeries(rows, windowDays) {
  const list = [];
  const now = new Date();
  for (let i = windowDays - 1; i >= 0; i -= 1) {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - i));
    list.push({ dateKey: date.toISOString().slice(0, 10), calls: 0, tokens: 0, blocked: 0 });
  }
  const byKey = new Map(list.map((row) => [row.dateKey, row]));
  (rows || []).forEach((row) => {
    const ms = toMillis(row && row.createdAt);
    if (!Number.isFinite(ms)) return;
    const key = toDateKey(ms);
    const target = byKey.get(key);
    if (!target) return;
    target.calls += 1;
    const tokenUsed = Number.isFinite(Number(row && row.tokenUsed)) ? Number(row.tokenUsed) : 0;
    target.tokens += tokenUsed;
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') target.blocked += 1;
  });
  return list;
}

function buildReasonBreakdown(rows) {
  const counts = new Map();
  (rows || []).forEach((row) => {
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision === 'allow') return;
    const reason = normalizeReason(row && row.blockedReason);
    counts.set(reason, (counts.get(reason) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);
}

function buildTopUsers(rows, limit) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const userId = typeof row.userId === 'string' && row.userId.trim() ? row.userId.trim() : 'unknown';
    const current = map.get(userId) || {
      userId,
      calls: 0,
      tokens: 0,
      blocked: 0,
      plan: typeof row.plan === 'string' && row.plan.trim() ? row.plan.trim() : 'free'
    };
    current.calls += 1;
    current.tokens += Number.isFinite(Number(row.tokenUsed)) ? Number(row.tokenUsed) : 0;
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') current.blocked += 1;
    map.set(userId, current);
  });
  return Array.from(map.values())
    .map((item) => Object.assign({}, item, {
      blockedRate: item.calls > 0 ? Math.round((item.blocked / item.calls) * 10000) / 10000 : 0
    }))
    .sort((a, b) => {
      if (b.calls !== a.calls) return b.calls - a.calls;
      if (b.tokens !== a.tokens) return b.tokens - a.tokens;
      return a.userId.localeCompare(b.userId, 'ja');
    })
    .slice(0, limit);
}

function buildPlanBreakdown(rows) {
  const base = {
    free: { calls: 0, tokens: 0, blocked: 0, blockedRate: 0 },
    pro: { calls: 0, tokens: 0, blocked: 0, blockedRate: 0 },
    other: { calls: 0, tokens: 0, blocked: 0, blockedRate: 0 }
  };
  (rows || []).forEach((row) => {
    const plan = String(row && row.plan ? row.plan : '').toLowerCase();
    const key = plan === 'free' || plan === 'pro' ? plan : 'other';
    const target = base[key];
    target.calls += 1;
    target.tokens += Number.isFinite(Number(row && row.tokenUsed)) ? Number(row.tokenUsed) : 0;
    const decision = String(row && row.decision ? row.decision : '').toLowerCase();
    if (decision !== 'allow') target.blocked += 1;
  });
  Object.keys(base).forEach((key) => {
    const target = base[key];
    target.blockedRate = target.calls > 0 ? Math.round((target.blocked / target.calls) * 10000) / 10000 : 0;
  });
  return base;
}

function buildDecisionBreakdown(rows) {
  const map = new Map();
  (rows || []).forEach((row) => {
    const decision = String(row && row.decision ? row.decision : 'unknown').toLowerCase() || 'unknown';
    map.set(decision, (map.get(decision) || 0) + 1);
  });
  return Array.from(map.entries())
    .map(([decision, count]) => ({ decision, count }))
    .sort((a, b) => b.count - a.count);
}

function extractAssistantQuality(row) {
  const quality = row && row.assistantQuality && typeof row.assistantQuality === 'object'
    ? row.assistantQuality
    : null;
  if (!quality) return null;
  return {
    intentResolved: typeof quality.intentResolved === 'string' ? quality.intentResolved.trim() : '',
    kbTopScore: Number.isFinite(Number(quality.kbTopScore)) ? Number(quality.kbTopScore) : null,
    evidenceCoverage: Number.isFinite(Number(quality.evidenceCoverage)) ? Number(quality.evidenceCoverage) : null,
    blockedStage: typeof quality.blockedStage === 'string' ? quality.blockedStage.trim() : '',
    fallbackReason: typeof quality.fallbackReason === 'string' ? quality.fallbackReason.trim() : ''
  };
}

function sortCountEntries(map, keyName, limit) {
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 20;
  return Array.from(map.entries())
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, cap);
}

function sortCountEntriesWithDefaults(map, keyName, defaults, limit) {
  const outMap = new Map(map);
  (Array.isArray(defaults) ? defaults : []).forEach((value) => {
    const key = normalizeReason(value);
    if (!outMap.has(key)) outMap.set(key, 0);
  });
  const rows = Array.from(outMap.entries())
    .map(([key, count]) => ({ [keyName]: key, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return String(a[keyName]).localeCompare(String(b[keyName]), 'ja');
    });
  const cap = Number.isInteger(limit) && limit > 0 ? limit : 20;
  return rows.slice(0, cap);
}

function buildAssistantQualitySummary(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const sampleRows = source
    .map((row) => ({ row, quality: extractAssistantQuality(row) }))
    .filter((entry) => Boolean(entry.quality));
  const sampleCount = sampleRows.length;
  const kbScores = sampleRows
    .map((entry) => entry.quality.kbTopScore)
    .filter((value) => Number.isFinite(value));
  const evidenceCoverageValues = sampleRows
    .map((entry) => entry.quality.evidenceCoverage)
    .filter((value) => Number.isFinite(value));
  const blockedStageMap = new Map();
  const fallbackReasonMap = new Map();
  const intentMap = new Map();
  const intentDecisionMap = new Map();

  sampleRows.forEach((entry) => {
    const quality = entry.quality;
    const row = entry.row || {};
    const blockedStage = quality.blockedStage || 'none';
    const fallbackReason = quality.fallbackReason || 'none';
    const intentResolved = quality.intentResolved || 'unknown';
    blockedStageMap.set(blockedStage, (blockedStageMap.get(blockedStage) || 0) + 1);
    fallbackReasonMap.set(fallbackReason, (fallbackReasonMap.get(fallbackReason) || 0) + 1);
    intentMap.set(intentResolved, (intentMap.get(intentResolved) || 0) + 1);
    const decision = String(row && row.decision ? row.decision : '').toLowerCase() || 'unknown';
    const current = intentDecisionMap.get(intentResolved) || { calls: 0, blocked: 0 };
    current.calls += 1;
    if (decision !== 'allow') current.blocked += 1;
    intentDecisionMap.set(intentResolved, current);
  });

  const acceptedRateByIntent = Array.from(intentDecisionMap.entries())
    .map(([intentResolved, stat]) => ({
      intentResolved,
      calls: stat.calls,
      blocked: stat.blocked,
      acceptedRate: stat.calls > 0
        ? Math.round(((stat.calls - stat.blocked) / stat.calls) * 10000) / 10000
        : 0
    }))
    .sort((a, b) => b.calls - a.calls)
    .slice(0, 10);

  return {
    sampleCount,
    avgKbTopScore: kbScores.length
      ? Math.round((kbScores.reduce((sum, value) => sum + value, 0) / kbScores.length) * 10000) / 10000
      : 0,
    avgEvidenceCoverage: evidenceCoverageValues.length
      ? Math.round((evidenceCoverageValues.reduce((sum, value) => sum + value, 0) / evidenceCoverageValues.length) * 10000) / 10000
      : 0,
    blockedStages: sortCountEntries(blockedStageMap, 'blockedStage', 20),
    fallbackReasons: sortCountEntries(fallbackReasonMap, 'fallbackReason', 20),
    intents: sortCountEntries(intentMap, 'intentResolved', 20),
    acceptedRateByIntent
  };
}

function buildGateAuditBaseline(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const filtered = list
    .map((row) => (row && row.payloadSummary && typeof row.payloadSummary === 'object' ? row.payloadSummary : null))
    .filter(Boolean);
  const callsTotal = filtered.length;
  const blockedReasons = new Map();
  const blockedStages = new Map();
  const entryTypes = new Map();
  const gatesCoverage = new Map();
  let allowCount = 0;
  filtered.forEach((summary) => {
    const entryType = normalizeReason(summary.entryType);
    entryTypes.set(entryType, (entryTypes.get(entryType) || 0) + 1);
    const gatesApplied = Array.isArray(summary.gatesApplied) ? summary.gatesApplied : [];
    gatesApplied.forEach((gate) => {
      const key = normalizeReason(gate);
      gatesCoverage.set(key, (gatesCoverage.get(key) || 0) + 1);
    });
    const decision = String(summary.decision || '').toLowerCase();
    if (decision === 'allow') {
      allowCount += 1;
      return;
    }
    const reason = normalizeReason(summary.blockedReason);
    blockedReasons.set(reason, (blockedReasons.get(reason) || 0) + 1);
    const quality = summary.assistantQuality && typeof summary.assistantQuality === 'object'
      ? summary.assistantQuality
      : null;
    const stage = quality && typeof quality.blockedStage === 'string' && quality.blockedStage.trim()
      ? quality.blockedStage.trim()
      : 'none';
    blockedStages.set(stage, (blockedStages.get(stage) || 0) + 1);
  });
  const blockedCount = callsTotal - allowCount;
  return {
    callsTotal,
    blockedCount,
    acceptedRate: callsTotal > 0 ? Math.round((allowCount / callsTotal) * 10000) / 10000 : 0,
    blockedReasons: sortCountEntries(blockedReasons, 'reason', 20),
    blockedStages: sortCountEntries(blockedStages, 'blockedStage', 20),
    entryTypes: sortCountEntriesWithDefaults(entryTypes, 'entryType', DASHBOARD_ENTRY_TYPES, 20),
    gatesCoverage: sortCountEntriesWithDefaults(gatesCoverage, 'gate', DASHBOARD_GATES, 20)
  };
}

function buildOptimizationSummary(actionRows, gateAuditBaseline) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const versions = new Map();
  const rewardVersions = new Map();
  const selectionSources = new Map();
  let rewardPendingCount = 0;
  const rewards = [];
  rows.forEach((row) => {
    const optimizationVersion = normalizeReason(row && row.optimizationVersion ? row.optimizationVersion : 'v1');
    versions.set(optimizationVersion, (versions.get(optimizationVersion) || 0) + 1);
    const rewardVersion = normalizeReason(row && row.rewardVersion ? row.rewardVersion : 'v1');
    rewardVersions.set(rewardVersion, (rewardVersions.get(rewardVersion) || 0) + 1);
    const selectionSource = normalizeReason(row && row.selectionSource ? row.selectionSource : 'score');
    selectionSources.set(selectionSource, (selectionSources.get(selectionSource) || 0) + 1);
    if (row && row.rewardPending === true) rewardPendingCount += 1;
    if (Number.isFinite(Number(row && row.reward))) rewards.push(Number(row.reward));
  });
  const versionRows = sortCountEntries(versions, 'optimizationVersion', 10);
  const primaryVersion = versionRows.length > 0 ? versionRows[0].optimizationVersion : 'v1';

  const baseline = gateAuditBaseline && typeof gateAuditBaseline === 'object' ? gateAuditBaseline : {};
  const entryRows = Array.isArray(baseline.entryTypes) ? baseline.entryTypes : [];
  let compatCount = 0;
  let totalCount = 0;
  entryRows.forEach((row) => {
    const count = Number.isFinite(Number(row && row.count)) ? Number(row.count) : 0;
    totalCount += count;
    if (normalizeReason(row && row.entryType) === 'compat') compatCount += count;
  });
  const compatShareWindow = totalCount > 0 ? Math.round((compatCount / totalCount) * 10000) / 10000 : 0;

  return {
    sampleCount: rows.length,
    optimizationVersion: primaryVersion,
    optimizationVersions: versionRows,
    rewardVersions: sortCountEntries(rewardVersions, 'rewardVersion', 10),
    selectionSources: sortCountEntries(selectionSources, 'selectionSource', 10),
    rewardPendingCount,
    avgReward: rewards.length > 0
      ? Math.round((rewards.reduce((sum, value) => sum + value, 0) / rewards.length) * 10000) / 10000
      : 0,
    compatShareWindow
  };
}

function buildConversationQualitySummary(actionRows) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const naturalnessVersions = new Map();
  const domainCounts = new Map();
  const fallbackTypes = new Map();
  const strategies = new Map();
  const retrievalQualities = new Map();
  const verificationOutcomes = new Map();
  const judgeWinners = new Map();
  const sourceReadinessDecisions = new Map();
  const readinessDecisions = new Map();
  const readinessSafeResponseModes = new Map();
  const followupIntents = new Map();
  const routerReasons = new Map();
  const contradictionFlags = new Map();
  let legacyTemplateHitCount = 0;
  let followupQuestionIncludedCount = 0;
  let pitfallIncludedCount = 0;
  let actionCountTotal = 0;
  let domainIntentCount = 0;
  let domainConciergeCount = 0;
  let candidateCountTotal = 0;
  let retrieveNeededCount = 0;
  let contradictionRowCount = 0;
  let sourceAuthorityScoreTotal = 0;
  let sourceAuthorityScoreCount = 0;
  let sourceFreshnessScoreTotal = 0;
  let sourceFreshnessScoreCount = 0;
  let officialOnlySatisfiedCount = 0;
  let unsupportedClaimCountTotal = 0;
  let contradictionDetectedCount = 0;
  let conciseModeAppliedCount = 0;
  let repetitionPreventedCount = 0;
  let defaultCasualCount = 0;

  rows.forEach((row) => {
    const naturalnessVersion = normalizeReason(row && row.conversationNaturalnessVersion ? row.conversationNaturalnessVersion : 'v1');
    const domainIntent = normalizeReason(row && row.domainIntent ? row.domainIntent : 'general');
    const conversationMode = normalizeReason(row && row.conversationMode ? row.conversationMode : 'casual');
    const fallbackType = normalizeReason(row && row.fallbackType ? row.fallbackType : 'none');
    const strategy = normalizeReason(row && row.strategy ? row.strategy : 'none');
    const retrievalQuality = normalizeReason(row && row.retrievalQuality ? row.retrievalQuality : 'none');
    const verificationOutcome = normalizeReason(row && row.verificationOutcome ? row.verificationOutcome : 'none');
    const judgeWinner = normalizeReason(row && row.judgeWinner ? row.judgeWinner : 'none');
    const sourceReadinessDecision = normalizeReason(row && row.sourceReadinessDecision ? row.sourceReadinessDecision : 'none');
    const readinessDecision = normalizeReason(row && row.readinessDecision ? row.readinessDecision : 'none');
    const readinessSafeResponseMode = normalizeReason(row && row.readinessSafeResponseMode ? row.readinessSafeResponseMode : 'none');
    const followupIntent = normalizeReason(row && row.followupIntent ? row.followupIntent : 'none');
    const routerReason = normalizeReason(row && row.routerReason ? row.routerReason : 'none');
    const actionCount = Number.isFinite(Number(row && row.actionCount)) ? Number(row.actionCount) : 0;
    const candidateCount = Number.isFinite(Number(row && row.candidateCount)) ? Number(row.candidateCount) : 0;
    const retrieveNeeded = row && row.retrieveNeeded === true;
    const rowContradictionFlags = Array.isArray(row && row.contradictionFlags) ? row.contradictionFlags : [];
    const legacyTemplateHit = row && row.legacyTemplateHit === true;
    const followupQuestionIncluded = row && row.followupQuestionIncluded === true;
    const pitfallIncluded = row && row.pitfallIncluded === true;
    const conciseModeApplied = row && row.conciseModeApplied === true;
    const repetitionPrevented = row && row.repetitionPrevented === true;

    naturalnessVersions.set(naturalnessVersion, (naturalnessVersions.get(naturalnessVersion) || 0) + 1);
    domainCounts.set(domainIntent, (domainCounts.get(domainIntent) || 0) + 1);
    fallbackTypes.set(fallbackType, (fallbackTypes.get(fallbackType) || 0) + 1);
    strategies.set(strategy, (strategies.get(strategy) || 0) + 1);
    retrievalQualities.set(retrievalQuality, (retrievalQualities.get(retrievalQuality) || 0) + 1);
    verificationOutcomes.set(verificationOutcome, (verificationOutcomes.get(verificationOutcome) || 0) + 1);
    judgeWinners.set(judgeWinner, (judgeWinners.get(judgeWinner) || 0) + 1);
    sourceReadinessDecisions.set(sourceReadinessDecision, (sourceReadinessDecisions.get(sourceReadinessDecision) || 0) + 1);
    readinessDecisions.set(readinessDecision, (readinessDecisions.get(readinessDecision) || 0) + 1);
    readinessSafeResponseModes.set(
      readinessSafeResponseMode,
      (readinessSafeResponseModes.get(readinessSafeResponseMode) || 0) + 1
    );
    followupIntents.set(followupIntent, (followupIntents.get(followupIntent) || 0) + 1);
    routerReasons.set(routerReason, (routerReasons.get(routerReason) || 0) + 1);
    actionCountTotal += Math.max(0, actionCount);
    candidateCountTotal += Math.max(0, candidateCount);
    if (retrieveNeeded) retrieveNeededCount += 1;
    if (legacyTemplateHit) legacyTemplateHitCount += 1;
    if (followupQuestionIncluded) followupQuestionIncludedCount += 1;
    if (pitfallIncluded) pitfallIncludedCount += 1;
    if (conciseModeApplied) conciseModeAppliedCount += 1;
    if (repetitionPrevented) repetitionPreventedCount += 1;
    if (routerReason === 'default_casual') defaultCasualCount += 1;
    if (row && row.officialOnlySatisfied === true) officialOnlySatisfiedCount += 1;
    if (Number.isFinite(Number(row && row.unsupportedClaimCount))) {
      unsupportedClaimCountTotal += Math.max(0, Number(row.unsupportedClaimCount));
    }
    if (row && row.contradictionDetected === true) contradictionDetectedCount += 1;
    if (Number.isFinite(Number(row && row.sourceAuthorityScore))) {
      sourceAuthorityScoreTotal += Number(row.sourceAuthorityScore);
      sourceAuthorityScoreCount += 1;
    }
    if (Number.isFinite(Number(row && row.sourceFreshnessScore))) {
      sourceFreshnessScoreTotal += Number(row.sourceFreshnessScore);
      sourceFreshnessScoreCount += 1;
    }
    if (rowContradictionFlags.length > 0) contradictionRowCount += 1;
    rowContradictionFlags.forEach((flag) => {
      const normalizedFlag = normalizeReason(flag);
      contradictionFlags.set(normalizedFlag, (contradictionFlags.get(normalizedFlag) || 0) + 1);
    });
    if (domainIntent !== 'general') {
      domainIntentCount += 1;
      if (conversationMode === 'concierge') domainConciergeCount += 1;
    }
  });

  const sampleCount = rows.length;
  const versionRows = sortCountEntries(naturalnessVersions, 'conversationNaturalnessVersion', 10);
  return {
    sampleCount,
    conversationNaturalnessVersion: versionRows.length > 0 ? versionRows[0].conversationNaturalnessVersion : 'v1',
    conversationNaturalnessVersions: versionRows,
    legacyTemplateHitRate: sampleCount > 0 ? Math.round((legacyTemplateHitCount / sampleCount) * 10000) / 10000 : 0,
    followupQuestionIncludedRate: sampleCount > 0 ? Math.round((followupQuestionIncludedCount / sampleCount) * 10000) / 10000 : 0,
    pitfallIncludedRate: sampleCount > 0 ? Math.round((pitfallIncludedCount / sampleCount) * 10000) / 10000 : 0,
    avgActionCount: sampleCount > 0 ? Math.round((actionCountTotal / sampleCount) * 10000) / 10000 : 0,
    avgCandidateCount: sampleCount > 0 ? Math.round((candidateCountTotal / sampleCount) * 10000) / 10000 : 0,
    retrieveNeededRate: sampleCount > 0 ? Math.round((retrieveNeededCount / sampleCount) * 10000) / 10000 : 0,
    contradictionRate: sampleCount > 0 ? Math.round((contradictionRowCount / sampleCount) * 10000) / 10000 : 0,
    domainIntentConciergeRate: domainIntentCount > 0 ? Math.round((domainConciergeCount / domainIntentCount) * 10000) / 10000 : 0,
    strategies: sortCountEntries(strategies, 'strategy', 10),
    retrievalQualities: sortCountEntries(retrievalQualities, 'retrievalQuality', 10),
    verificationOutcomes: sortCountEntries(verificationOutcomes, 'verificationOutcome', 10),
    judgeWinners: sortCountEntries(judgeWinners, 'judgeWinner', 10),
    sourceReadinessDecisions: sortCountEntries(sourceReadinessDecisions, 'sourceReadinessDecision', 10),
    avgSourceAuthorityScore: sourceAuthorityScoreCount > 0
      ? Math.round((sourceAuthorityScoreTotal / sourceAuthorityScoreCount) * 10000) / 10000
      : 0,
    avgSourceFreshnessScore: sourceFreshnessScoreCount > 0
      ? Math.round((sourceFreshnessScoreTotal / sourceFreshnessScoreCount) * 10000) / 10000
      : 0,
    officialOnlySatisfiedRate: sampleCount > 0
      ? Math.round((officialOnlySatisfiedCount / sampleCount) * 10000) / 10000
      : 0,
    readinessDecisions: sortCountEntries(readinessDecisions, 'readinessDecision', 10),
    readinessSafeResponseModes: sortCountEntries(readinessSafeResponseModes, 'readinessSafeResponseMode', 10),
    followupIntents: sortCountEntries(followupIntents, 'followupIntent', 10),
    routerReasons: sortCountEntries(routerReasons, 'routerReason', 12),
    avgUnsupportedClaimCount: sampleCount > 0
      ? Math.round((unsupportedClaimCountTotal / sampleCount) * 10000) / 10000
      : 0,
    contradictionDetectedRate: sampleCount > 0
      ? Math.round((contradictionDetectedCount / sampleCount) * 10000) / 10000
      : 0,
    conciseModeAppliedRate: sampleCount > 0
      ? Math.round((conciseModeAppliedCount / sampleCount) * 10000) / 10000
      : 0,
    repetitionPreventedRate: sampleCount > 0
      ? Math.round((repetitionPreventedCount / sampleCount) * 10000) / 10000
      : 0,
    defaultCasualRate: sampleCount > 0
      ? Math.round((defaultCasualCount / sampleCount) * 10000) / 10000
      : 0,
    contradictionFlags: sortCountEntries(contradictionFlags, 'flag', 10),
    domainIntents: sortCountEntries(domainCounts, 'domainIntent', 10),
    fallbackTypes: sortCountEntries(fallbackTypes, 'fallbackType', 10)
  };
}

function toCountMap(rows, keyField) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (!row || typeof row !== 'object') return;
    const key = normalizeReason(row[keyField]);
    const count = Number.isFinite(Number(row.count)) ? Number(row.count) : 0;
    map.set(key, count);
  });
  return map;
}

function buildReleaseReadiness(payload, thresholdsInput) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const thresholds = Object.assign({}, DEFAULT_RELEASE_READINESS_THRESHOLDS, thresholdsInput || {});
  const assistantQuality = data.assistantQuality && typeof data.assistantQuality === 'object' ? data.assistantQuality : {};
  const gateAuditBaseline = data.gateAuditBaseline && typeof data.gateAuditBaseline === 'object' ? data.gateAuditBaseline : {};

  const sampleCount = Number.isFinite(Number(assistantQuality.sampleCount)) ? Number(assistantQuality.sampleCount) : 0;
  const acceptedRate = Number.isFinite(Number(gateAuditBaseline.acceptedRate)) ? Number(gateAuditBaseline.acceptedRate) : 0;
  const blockedRate = Number.isFinite(Number(gateAuditBaseline.blockedCount)) && Number.isFinite(Number(gateAuditBaseline.callsTotal)) && Number(gateAuditBaseline.callsTotal) > 0
    ? Math.round((Number(gateAuditBaseline.blockedCount) / Number(gateAuditBaseline.callsTotal)) * 10000) / 10000
    : Math.max(0, Math.min(1, Math.round((1 - acceptedRate) * 10000) / 10000));
  const avgEvidenceCoverage = Number.isFinite(Number(assistantQuality.avgEvidenceCoverage))
    ? Number(assistantQuality.avgEvidenceCoverage)
    : 0;

  const blockedReasonMap = toCountMap(gateAuditBaseline.blockedReasons, 'reason');
  const fallbackReasonMap = toCountMap(assistantQuality.fallbackReasons, 'fallbackReason');
  const callsTotal = Number.isFinite(Number(gateAuditBaseline.callsTotal)) ? Number(gateAuditBaseline.callsTotal) : 0;

  const citationMissingCount = blockedReasonMap.get('citation_missing') || 0;
  const templateViolationCount = blockedReasonMap.get('template_violation') || 0;
  const citationMissingRate = callsTotal > 0 ? Math.round((citationMissingCount / callsTotal) * 10000) / 10000 : 0;
  const templateViolationRate = callsTotal > 0 ? Math.round((templateViolationCount / callsTotal) * 10000) / 10000 : 0;

  const fallbackTotalCount = Array.from(fallbackReasonMap.entries()).reduce((sum, [reason, count]) => {
    if (reason === 'none') return sum;
    return sum + count;
  }, 0);
  const fallbackRate = sampleCount > 0 ? Math.round((fallbackTotalCount / sampleCount) * 10000) / 10000 : 0;

  const checks = [
    {
      key: 'sample_count',
      operator: '>=',
      threshold: thresholds.minSampleCount,
      actual: sampleCount,
      ok: sampleCount >= thresholds.minSampleCount
    },
    {
      key: 'accepted_rate',
      operator: '>=',
      threshold: thresholds.minAcceptedRate,
      actual: acceptedRate,
      ok: acceptedRate >= thresholds.minAcceptedRate
    },
    {
      key: 'citation_missing_rate',
      operator: '<=',
      threshold: thresholds.maxCitationMissingRate,
      actual: citationMissingRate,
      ok: citationMissingRate <= thresholds.maxCitationMissingRate
    },
    {
      key: 'template_violation_rate',
      operator: '<=',
      threshold: thresholds.maxTemplateViolationRate,
      actual: templateViolationRate,
      ok: templateViolationRate <= thresholds.maxTemplateViolationRate
    },
    {
      key: 'fallback_rate',
      operator: '<=',
      threshold: thresholds.maxFallbackRate,
      actual: fallbackRate,
      ok: fallbackRate <= thresholds.maxFallbackRate
    },
    {
      key: 'avg_evidence_coverage',
      operator: '>=',
      threshold: thresholds.minEvidenceCoverage,
      actual: avgEvidenceCoverage,
      ok: avgEvidenceCoverage >= thresholds.minEvidenceCoverage
    }
  ];

  const blockedBy = checks.filter((item) => item.ok !== true).map((item) => item.key);
  return {
    ready: blockedBy.length === 0,
    recommendation: blockedBy.length === 0 ? 'promote_to_prod' : 'hold_in_stg',
    blockedBy,
    thresholds,
    metrics: {
      sampleCount,
      callsTotal,
      acceptedRate,
      blockedRate,
      citationMissingRate,
      templateViolationRate,
      fallbackRate,
      avgEvidenceCoverage
    },
    checks
  };
}

function buildMaskedTopUsers(rows, limit) {
  return buildTopUsers(rows, limit).map((row) => Object.assign({}, row, {
    userIdMasked: maskLineUserId(row.userId)
  }));
}

async function handleLlmUsageSummary(req, res) {
  const actor = requireActor(req, res);
  if (!actor) return;

  const traceId = resolveTraceId(req);
  const requestId = resolveRequestId(req);

  try {
    const url = new URL(req.url, 'http://localhost');
    const windowDays = parsePositiveInt(url.searchParams.get('windowDays'), 7, 1, 90);
    const limit = parsePositiveInt(url.searchParams.get('limit'), 20, 1, 100);
    const scanLimit = parsePositiveInt(url.searchParams.get('scanLimit'), 3000, 100, 5000);
    const rolloutMinSampleCount = parsePositiveInt(
      url.searchParams.get('rolloutMinSampleCount'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.minSampleCount,
      1,
      10000
    );
    const rolloutMinAcceptedRate = parseRate(
      url.searchParams.get('rolloutMinAcceptedRate'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.minAcceptedRate
    );
    const rolloutMaxCitationMissingRate = parseRate(
      url.searchParams.get('rolloutMaxCitationMissingRate'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.maxCitationMissingRate
    );
    const rolloutMaxTemplateViolationRate = parseRate(
      url.searchParams.get('rolloutMaxTemplateViolationRate'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.maxTemplateViolationRate
    );
    const rolloutMaxFallbackRate = parseRate(
      url.searchParams.get('rolloutMaxFallbackRate'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.maxFallbackRate
    );
    const rolloutMinEvidenceCoverage = parseRate(
      url.searchParams.get('rolloutMinEvidenceCoverage'),
      DEFAULT_RELEASE_READINESS_THRESHOLDS.minEvidenceCoverage
    );
    if (
      windowDays === null
      || limit === null
      || scanLimit === null
      || rolloutMinSampleCount === null
      || rolloutMinAcceptedRate === null
      || rolloutMaxCitationMissingRate === null
      || rolloutMaxTemplateViolationRate === null
      || rolloutMaxFallbackRate === null
      || rolloutMinEvidenceCoverage === null
    ) throw new Error('invalid limit');

    const toAt = new Date();
    const fromAt = new Date(Date.now() - ((windowDays - 1) * 24 * 60 * 60 * 1000));
    const rows = await llmUsageLogsRepo.listLlmUsageLogsByCreatedAtRange({
      fromAt,
      toAt,
      limit: scanLimit
    });
    let gateAuditRows = [];
    let actionRows = [];
    try {
      const rawAuditRows = await auditLogsRepo.listAuditLogs({
        action: 'llm_gate.decision',
        limit: scanLimit
      });
      const fromMs = fromAt.getTime();
      const toMs = toAt.getTime();
      gateAuditRows = (Array.isArray(rawAuditRows) ? rawAuditRows : []).filter((row) => {
        const ms = toMillis(row && row.createdAt);
        return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
      });
    } catch (_err) {
      gateAuditRows = [];
    }
    try {
      actionRows = await llmActionLogsRepo.listLlmActionLogsByCreatedAtRange({
        fromAt,
        toAt,
        limit: scanLimit
      });
    } catch (_err) {
      actionRows = [];
    }

    const callsTotal = Array.isArray(rows) ? rows.length : 0;
    const tokensTotal = sumBy(rows, (row) => row && row.tokenUsed);
    const blockedCount = (rows || []).filter((row) => String(row && row.decision ? row.decision : '').toLowerCase() !== 'allow').length;
    const blockedRate = callsTotal > 0 ? Math.round((blockedCount / callsTotal) * 10000) / 10000 : 0;
    const proRows = (rows || []).filter((row) => String(row && row.plan ? row.plan : '').toLowerCase() === 'pro');
    const proAvgUsage = proRows.length > 0
      ? Math.round((proRows.length / Math.max(1, new Set(proRows.map((row) => String(row && row.userId ? row.userId : 'unknown'))).size)) * 100) / 100
      : 0;

    const assistantQualitySummary = buildAssistantQualitySummary(rows);
    const gateAuditBaselineSummary = buildGateAuditBaseline(gateAuditRows);
    const optimizationSummary = buildOptimizationSummary(actionRows, gateAuditBaselineSummary);
    const conversationQualitySummary = buildConversationQualitySummary(actionRows);
    const releaseReadiness = buildReleaseReadiness({
      assistantQuality: assistantQualitySummary,
      gateAuditBaseline: gateAuditBaselineSummary
    }, {
      minSampleCount: rolloutMinSampleCount,
      minAcceptedRate: rolloutMinAcceptedRate,
      maxCitationMissingRate: rolloutMaxCitationMissingRate,
      maxTemplateViolationRate: rolloutMaxTemplateViolationRate,
      maxFallbackRate: rolloutMaxFallbackRate,
      minEvidenceCoverage: rolloutMinEvidenceCoverage
    });

    const summary = {
      windowDays,
      callsTotal,
      tokensTotal,
      blockedCount,
      blockedRate,
      proAvgUsage,
      byDay: buildDailySeries(rows, windowDays),
      blockedReasons: buildReasonBreakdown(rows),
      topUsers: buildTopUsers(rows, limit),
      maskedTopUsers: buildMaskedTopUsers(rows, limit),
      byPlan: buildPlanBreakdown(rows),
      byDecision: buildDecisionBreakdown(rows),
      assistantQuality: assistantQualitySummary,
      gateAuditBaseline: gateAuditBaselineSummary,
      optimization: optimizationSummary,
      conversationQuality: conversationQualitySummary,
      releaseReadiness
    };

    await appendAuditLog({
      actor,
      action: 'llm_usage.summary.view',
      entityType: 'llm_usage',
      entityId: `window_${windowDays}d`,
      traceId,
      requestId,
      payloadSummary: {
        windowDays,
        callsTotal,
        blockedRate,
        releaseReady: releaseReadiness.ready === true,
        releaseBlockedBy: releaseReadiness.blockedBy.slice(0, 6),
        optimizationVersion: optimizationSummary.optimizationVersion,
        compatShareWindow: optimizationSummary.compatShareWindow,
        scanLimit,
        topUserCount: summary.topUsers.length
      }
    });

    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      ok: true,
      traceId,
      requestId,
      summary
    }));
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    if (message.startsWith('invalid ')) {
      res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: message, traceId, requestId }));
      return;
    }
    logRouteError('admin.os_llm_usage_summary', err, { traceId, requestId, actor });
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'error', traceId, requestId }));
  }
}

module.exports = {
  handleLlmUsageSummary,
  buildDailySeries,
  buildReasonBreakdown,
  buildTopUsers,
  buildMaskedTopUsers,
  buildPlanBreakdown,
  buildDecisionBreakdown,
  buildAssistantQualitySummary,
  buildGateAuditBaseline,
  buildOptimizationSummary,
  buildConversationQualitySummary,
  buildReleaseReadiness,
  maskLineUserId
};
