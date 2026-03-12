'use strict';

const llmUsageLogsRepo = require('../../repos/firestore/llmUsageLogsRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const specContractRegistry = require('../../../contracts/llm_spec_contract_registry.v2.json');
const { buildBacklogRowsFromSignals } = require('../../../tools/generate_llm_improvement_plan');
const { appendAuditLog } = require('../../usecases/audit/appendAuditLog');
const { requireActor, resolveRequestId, resolveTraceId, logRouteError } = require('./osContext');
const { buildCounterexampleQueueFromSignalEntries } = require('../../domain/llm/quality/counterexampleQueue');

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
const QUALITY_DIMENSIONS = Object.freeze([
  { key: 'factuality_grounding', hardGate: true, weight: 0.12 },
  { key: 'source_authority_freshness', hardGate: true, weight: 0.08 },
  { key: 'procedural_utility', hardGate: false, weight: 0.06 },
  { key: 'next_step_clarity', hardGate: false, weight: 0.05 },
  { key: 'conversation_continuity', hardGate: false, weight: 0.06 },
  { key: 'short_followup_understanding', hardGate: true, weight: 0.06 },
  { key: 'clarification_quality', hardGate: false, weight: 0.04 },
  { key: 'repetition_loop_avoidance', hardGate: true, weight: 0.08 },
  { key: 'direct_answer_first', hardGate: false, weight: 0.04 },
  { key: 'japanese_naturalness', hardGate: false, weight: 0.04 },
  { key: 'japanese_service_quality', hardGate: true, weight: 0.05 },
  { key: 'keigo_distance', hardGate: false, weight: 0.02 },
  { key: 'empathy', hardGate: false, weight: 0.03 },
  { key: 'cultural_habit_fit', hardGate: true, weight: 0.03 },
  { key: 'line_native_fit', hardGate: true, weight: 0.04 },
  { key: 'action_policy_compliance', hardGate: true, weight: 0.04 },
  { key: 'safety_compliance_privacy', hardGate: true, weight: 0.08 },
  { key: 'memory_integrity', hardGate: true, weight: 0.03 },
  { key: 'group_chat_privacy', hardGate: true, weight: 0.03 },
  { key: 'minority_persona_robustness', hardGate: true, weight: 0.03 },
  { key: 'misunderstanding_recovery', hardGate: false, weight: 0.02 },
  { key: 'escalation_appropriateness', hardGate: true, weight: 0.02 },
  { key: 'operational_reliability', hardGate: true, weight: 0.03 },
  { key: 'latency_surface_efficiency', hardGate: false, weight: 0.04 }
]);
const QUALITY_SLICES = Object.freeze([
  { sliceKey: 'paid', critical: false },
  { sliceKey: 'free', critical: false },
  { sliceKey: 'admin', critical: false },
  { sliceKey: 'compat', critical: false },
  { sliceKey: 'short_followup', critical: true },
  { sliceKey: 'domain_continuation', critical: true },
  { sliceKey: 'group_chat', critical: true },
  { sliceKey: 'japanese_service_quality', critical: true },
  { sliceKey: 'minority_personas', critical: true },
  { sliceKey: 'cultural_slices', critical: true }
]);
const QUALITY_FRONTIER_THRESHOLDS = Object.freeze({
  qualityDeltaWarningBelow: 2,
  latencyRegressionWarnRate: 0.25,
  costRegressionBlockRate: 0.2,
  ackSlaViolationBlockRate: 0.01
});
const QUALITY_LOOP_V2_PRIORITY_ORDER = Object.freeze([
  'Emergency',
  'Legal / Consent',
  'Task Blocker',
  'Journey State',
  'City Pack / Source Refs / Local Guidance',
  'Saved FAQ',
  'Generic LLM reasoning'
]);
const QUALITY_LOOP_V2_CRITICAL_SLICES = Object.freeze([
  'emergency_high_risk',
  'saved_faq_high_risk_reuse',
  'journey_blocker_conflict',
  'stale_city_pack_required_source',
  'compat_spike',
  'trace_join_incomplete',
  'direct_url_leakage',
  'official_source_missing_on_high_risk'
]);
const QUALITY_LOOP_V2_RESERVATIONS = Object.freeze([
  'judge_disagreement_queue',
  'integration_counterexample_registry',
  'replay_slice_registry',
  'saved_faq_retirement_review',
  'emergency_override_review_queue',
  'city_pack_freshness_recertification_report'
]);
const QUALITY_LOOP_V2_THRESHOLDS = Object.freeze({
  cityPackGroundingRate: 0.9,
  staleSourceBlockRate: 0.95,
  emergencyOfficialSourceRate: 1,
  journeyAlignedActionRate: 0.85,
  taskBlockerConflictRate: 0.02,
  savedFaqReusePassRate: 0.9,
  officialSourceUsageRateHighRisk: 0.95,
  compatShareWindow: 0.15,
  traceJoinCompleteness: 0.9,
  adminTraceResolutionTimeMsStg: 15 * 60 * 1000,
  crossSystemConflictWarningRate: 0.05
});

function buildContractFreezeSummary(registryPayload) {
  const payload = registryPayload && typeof registryPayload === 'object' ? registryPayload : {};
  const requirements = Array.isArray(payload.requirements) ? payload.requirements : [];
  const conflicts = Array.isArray(payload.conflicts) ? payload.conflicts : [];
  const statusCounts = requirements.reduce((acc, row) => {
    const key = normalizeReason(row && row.status ? row.status : 'unknown');
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const blockingConflicts = conflicts.filter((row) => row && row.blocking === true).length;
  return {
    registryVersion: typeof payload.registryVersion === 'string' ? payload.registryVersion : 'unknown',
    registryHash: typeof payload.registryHash === 'string' ? payload.registryHash : 'unknown',
    requirementCount: requirements.length,
    blockingConflictCount: blockingConflicts,
    statusCounts
  };
}

const CONTRACT_FREEZE_SUMMARY = Object.freeze(buildContractFreezeSummary(specContractRegistry));

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
  const entryStats = new Map();
  const entryQuality = new Map();
  let allowCount = 0;
  filtered.forEach((summary) => {
    const entryType = normalizeReason(summary.entryType);
    entryTypes.set(entryType, (entryTypes.get(entryType) || 0) + 1);
    const stat = entryStats.get(entryType) || { calls: 0, allow: 0 };
    stat.calls += 1;
    const gatesApplied = Array.isArray(summary.gatesApplied) ? summary.gatesApplied : [];
    gatesApplied.forEach((gate) => {
      const key = normalizeReason(gate);
      gatesCoverage.set(key, (gatesCoverage.get(key) || 0) + 1);
    });
    const quality = entryQuality.get(entryType) || {
      sampleCount: 0,
      legacyTemplateHitCount: 0,
      conciseModeAppliedCount: 0,
      directAnswerAppliedCount: 0,
      repetitionPreventedCount: 0,
      clarifySuppressedCount: 0,
      defaultCasualCount: 0,
      followupQuestionIncludedCount: 0,
      contextCarryScoreTotal: 0,
      contextCarryScoreCount: 0,
      repeatRiskScoreTotal: 0,
      repeatRiskScoreCount: 0
    };
    quality.sampleCount += 1;
    if (summary.legacyTemplateHit === true) quality.legacyTemplateHitCount += 1;
    if (summary.conciseModeApplied === true) quality.conciseModeAppliedCount += 1;
    if (summary.directAnswerApplied === true) quality.directAnswerAppliedCount += 1;
    if (summary.repetitionPrevented === true) quality.repetitionPreventedCount += 1;
    if (summary.clarifySuppressed === true) quality.clarifySuppressedCount += 1;
    if (summary.followupQuestionIncluded === true) quality.followupQuestionIncludedCount += 1;
    if (normalizeReason(summary.routerReason).toLowerCase() === 'default_casual') quality.defaultCasualCount += 1;
    if (Number.isFinite(Number(summary.contextCarryScore))) {
      quality.contextCarryScoreTotal += Number(summary.contextCarryScore);
      quality.contextCarryScoreCount += 1;
    }
    if (Number.isFinite(Number(summary.repeatRiskScore))) {
      quality.repeatRiskScoreTotal += Number(summary.repeatRiskScore);
      quality.repeatRiskScoreCount += 1;
    }
    entryQuality.set(entryType, quality);
    const decision = String(summary.decision || '').toLowerCase();
    if (decision === 'allow') {
      allowCount += 1;
      stat.allow += 1;
      entryStats.set(entryType, stat);
      return;
    }
    const reason = normalizeReason(summary.blockedReason);
    blockedReasons.set(reason, (blockedReasons.get(reason) || 0) + 1);
    const assistantQuality = summary.assistantQuality && typeof summary.assistantQuality === 'object'
      ? summary.assistantQuality
      : null;
    const stage = assistantQuality && typeof assistantQuality.blockedStage === 'string' && assistantQuality.blockedStage.trim()
      ? assistantQuality.blockedStage.trim()
      : 'none';
    blockedStages.set(stage, (blockedStages.get(stage) || 0) + 1);
    entryStats.set(entryType, stat);
  });
  const blockedCount = callsTotal - allowCount;
  const entryStatsRows = sortCountEntriesWithDefaults(entryTypes, 'entryType', DASHBOARD_ENTRY_TYPES, 20)
    .map((row) => {
      const stat = entryStats.get(row.entryType) || { calls: row.count, allow: 0 };
      const acceptedRate = stat.calls > 0 ? Math.round((stat.allow / stat.calls) * 10000) / 10000 : 0;
      return {
        entryType: row.entryType,
        count: row.count,
        allowCount: stat.allow,
        acceptedRate
      };
    });
  const entryQualityKeys = Array.from(new Set([
    ...DASHBOARD_ENTRY_TYPES.map((value) => normalizeReason(value)),
    ...Array.from(entryQuality.keys()).map((value) => normalizeReason(value))
  ]));
  const entryQualitySignals = entryQualityKeys
    .map((entryType) => {
      const signal = entryQuality.get(entryType) || {};
      const sampleCount = Number.isFinite(Number(signal.sampleCount)) ? Number(signal.sampleCount) : 0;
      const divide = (num) => sampleCount > 0 ? Math.round((Number(num || 0) / sampleCount) * 10000) / 10000 : 0;
      const contextCarryScore = Number(signal.contextCarryScoreCount || 0) > 0
        ? Math.round((Number(signal.contextCarryScoreTotal || 0) / Number(signal.contextCarryScoreCount || 1)) * 10000) / 10000
        : 0;
      const repeatRiskScore = Number(signal.repeatRiskScoreCount || 0) > 0
        ? Math.round((Number(signal.repeatRiskScoreTotal || 0) / Number(signal.repeatRiskScoreCount || 1)) * 10000) / 10000
        : 0;
      return {
        entryType,
        sampleCount,
        legacyTemplateHitRate: divide(signal.legacyTemplateHitCount),
        conciseModeAppliedRate: divide(signal.conciseModeAppliedCount),
        directAnswerAppliedRate: divide(signal.directAnswerAppliedCount),
        repetitionPreventedRate: divide(signal.repetitionPreventedCount),
        clarifySuppressedRate: divide(signal.clarifySuppressedCount),
        defaultCasualRate: divide(signal.defaultCasualCount),
        followupQuestionIncludedRate: divide(signal.followupQuestionIncludedCount),
        avgContextCarryScore: contextCarryScore,
        avgRepeatRiskScore: repeatRiskScore
      };
    })
    .sort((a, b) => {
      if (b.sampleCount !== a.sampleCount) return b.sampleCount - a.sampleCount;
      return String(a.entryType).localeCompare(String(b.entryType), 'ja');
    })
    .slice(0, 20);
  return {
    callsTotal,
    blockedCount,
    acceptedRate: callsTotal > 0 ? Math.round((allowCount / callsTotal) * 10000) / 10000 : 0,
    blockedReasons: sortCountEntries(blockedReasons, 'reason', 20),
    blockedStages: sortCountEntries(blockedStages, 'blockedStage', 20),
    entryTypes: entryStatsRows,
    entryQualitySignals,
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
  const rawRows = Array.isArray(actionRows) ? actionRows : [];
  const conversationRows = rawRows.filter((row) => {
    if (!row || typeof row !== 'object') return false;
    const entryType = normalizeReason(row.entryType).toLowerCase();
    if (entryType === 'job') return false;
    if (typeof row.conversationMode === 'string' && row.conversationMode.trim()) return true;
    if (typeof row.routerReason === 'string' && row.routerReason.trim()) return true;
    if (typeof row.strategy === 'string' && row.strategy.trim()) return true;
    if (typeof row.domainIntent === 'string' && row.domainIntent.trim()) return true;
    if (typeof row.followupIntent === 'string' && row.followupIntent.trim()) return true;
    if (row.directAnswerApplied === true) return true;
    if (row.misunderstandingRecovered === true) return true;
    if (row.conciseModeApplied === true) return true;
    if (row.repetitionPrevented === true) return true;
    if (row.clarifySuppressed === true) return true;
    if (Number.isFinite(Number(row.contextCarryScore))) return true;
    if (Number.isFinite(Number(row.repeatRiskScore))) return true;
    return false;
  });
  const rows = conversationRows.length > 0 ? conversationRows : rawRows;
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
  const followupIntentReasons = new Map();
  const routerReasons = new Map();
  const parentIntentTypes = new Map();
  const parentAnswerModes = new Map();
  const parentLifecycleStages = new Map();
  const parentChapters = new Map();
  const parentRoutingInvariantStatuses = new Map();
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
  let conciseModeAppliedSeenCount = 0;
  let repetitionPreventedCount = 0;
  let repetitionPreventedSeenCount = 0;
  let defaultCasualCount = 0;
  let defaultCasualSeenCount = 0;
  let directAnswerAppliedCount = 0;
  let directAnswerAppliedSeenCount = 0;
  let clarifySuppressedCount = 0;
  let clarifySuppressedSeenCount = 0;
  let contextCarryScoreTotal = 0;
  let contextCarryScoreCount = 0;
  let repeatRiskScoreTotal = 0;
  let repeatRiskScoreCount = 0;
  let followupQuestionIncludedSeenCount = 0;
  let pitfallIncludedSeenCount = 0;
  let followupIntentSeenCount = 0;
  let followupResolvedCount = 0;
  let followupCarryFromHistorySeenCount = 0;
  let followupCarryFromHistoryCount = 0;
  let contextResumeSeenCount = 0;
  let contextResumeHandledCount = 0;
  let recoverySignalSeenCount = 0;
  let recoverySignalCount = 0;
  let misunderstandingRecoveredSeenCount = 0;
  let misunderstandingRecoveredCount = 0;
  let recoveryRiskSeenCount = 0;
  let recoveryHandledCount = 0;
  let requiredCoreFactsSeenCount = 0;
  let requiredCoreFactsCompleteCount = 0;
  let requiredCoreFactsMissingCountTotal = 0;
  let requiredCoreFactsCriticalMissingCountTotal = 0;
  const requiredCoreFactsGateDecisions = new Map();

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
    const followupIntentReason = normalizeReason(row && row.followupIntentReason ? row.followupIntentReason : 'none');
    const routerReason = normalizeReason(row && row.routerReason ? row.routerReason : 'none');
    const parentIntentType = normalizeReason(row && row.parentIntentType ? row.parentIntentType : 'none');
    const parentAnswerMode = normalizeReason(row && row.parentAnswerMode ? row.parentAnswerMode : 'none');
    const parentLifecycleStage = normalizeReason(row && row.parentLifecycleStage ? row.parentLifecycleStage : 'none');
    const parentChapter = normalizeReason(row && row.parentChapter ? row.parentChapter : 'none');
    const parentRoutingInvariantStatus = normalizeReason(row && row.parentRoutingInvariantStatus ? row.parentRoutingInvariantStatus : 'none');
    const requiredCoreFactsComplete = row && row.requiredCoreFactsComplete === true;
    const requiredCoreFactsMissingCount = Number.isFinite(Number(row && row.missingRequiredCoreFactsCount))
      ? Math.max(0, Number(row.missingRequiredCoreFactsCount))
      : null;
    const requiredCoreFactsCriticalMissingCount = Number.isFinite(Number(row && row.requiredCoreFactsCriticalMissingCount))
      ? Math.max(0, Number(row.requiredCoreFactsCriticalMissingCount))
      : null;
    const requiredCoreFactsGateDecision = normalizeReason(
      row && row.requiredCoreFactsGateDecision ? row.requiredCoreFactsGateDecision : 'none'
    );
    const actionCount = Number.isFinite(Number(row && row.actionCount)) ? Number(row.actionCount) : 0;
    const candidateCount = Number.isFinite(Number(row && row.candidateCount)) ? Number(row.candidateCount) : 0;
    const retrieveNeeded = row && row.retrieveNeeded === true;
    const rowContradictionFlags = Array.isArray(row && row.contradictionFlags) ? row.contradictionFlags : [];
    const legacyTemplateHit = row && row.legacyTemplateHit === true;
    const followupQuestionIncluded = row && row.followupQuestionIncluded === true;
    const pitfallIncluded = row && row.pitfallIncluded === true;
    const conciseModeApplied = row && row.conciseModeApplied === true;
    const repetitionPrevented = row && row.repetitionPrevented === true;
    const directAnswerApplied = row && row.directAnswerApplied === true;
    const clarifySuppressed = row && row.clarifySuppressed === true;
    const misunderstandingRecovered = row && row.misunderstandingRecovered === true;
    const followupCarryFromHistory = row && row.followupCarryFromHistory === true;
    const recoverySignal = row && row.recoverySignal === true;
    const contextCarryScore = Number.isFinite(Number(row && row.contextCarryScore)) ? Number(row.contextCarryScore) : null;
    const repeatRiskScore = Number.isFinite(Number(row && row.repeatRiskScore)) ? Number(row.repeatRiskScore) : null;

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
    followupIntentReasons.set(followupIntentReason, (followupIntentReasons.get(followupIntentReason) || 0) + 1);
    routerReasons.set(routerReason, (routerReasons.get(routerReason) || 0) + 1);
    parentIntentTypes.set(parentIntentType, (parentIntentTypes.get(parentIntentType) || 0) + 1);
    parentAnswerModes.set(parentAnswerMode, (parentAnswerModes.get(parentAnswerMode) || 0) + 1);
    parentLifecycleStages.set(parentLifecycleStage, (parentLifecycleStages.get(parentLifecycleStage) || 0) + 1);
    parentChapters.set(parentChapter, (parentChapters.get(parentChapter) || 0) + 1);
    parentRoutingInvariantStatuses.set(
      parentRoutingInvariantStatus,
      (parentRoutingInvariantStatuses.get(parentRoutingInvariantStatus) || 0) + 1
    );
    requiredCoreFactsGateDecisions.set(
      requiredCoreFactsGateDecision,
      (requiredCoreFactsGateDecisions.get(requiredCoreFactsGateDecision) || 0) + 1
    );
    actionCountTotal += Math.max(0, actionCount);
    candidateCountTotal += Math.max(0, candidateCount);
    if (retrieveNeeded) retrieveNeededCount += 1;
    if (legacyTemplateHit) legacyTemplateHitCount += 1;
    if (Object.prototype.hasOwnProperty.call(row, 'followupQuestionIncluded')) {
      followupQuestionIncludedSeenCount += 1;
      if (followupQuestionIncluded) followupQuestionIncludedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'pitfallIncluded')) {
      pitfallIncludedSeenCount += 1;
      if (pitfallIncluded) pitfallIncludedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'conciseModeApplied')) {
      conciseModeAppliedSeenCount += 1;
      if (conciseModeApplied) conciseModeAppliedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'repetitionPrevented')) {
      repetitionPreventedSeenCount += 1;
      if (repetitionPrevented) repetitionPreventedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'directAnswerApplied')) {
      directAnswerAppliedSeenCount += 1;
      if (directAnswerApplied) directAnswerAppliedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'clarifySuppressed')) {
      clarifySuppressedSeenCount += 1;
      if (clarifySuppressed) clarifySuppressedCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'followupCarryFromHistory')) {
      followupCarryFromHistorySeenCount += 1;
      if (followupCarryFromHistory) followupCarryFromHistoryCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'recoverySignal')) {
      recoverySignalSeenCount += 1;
      if (recoverySignal) recoverySignalCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'misunderstandingRecovered')) {
      misunderstandingRecoveredSeenCount += 1;
      if (misunderstandingRecovered) misunderstandingRecoveredCount += 1;
    }
    if (Object.prototype.hasOwnProperty.call(row, 'requiredCoreFactsComplete')) {
      requiredCoreFactsSeenCount += 1;
      if (requiredCoreFactsComplete) requiredCoreFactsCompleteCount += 1;
    }
    if (requiredCoreFactsMissingCount !== null) {
      requiredCoreFactsMissingCountTotal += requiredCoreFactsMissingCount;
    }
    if (requiredCoreFactsCriticalMissingCount !== null) {
      requiredCoreFactsCriticalMissingCountTotal += requiredCoreFactsCriticalMissingCount;
    }
    if (typeof row.routerReason === 'string' && row.routerReason.trim()) {
      defaultCasualSeenCount += 1;
      if (routerReason === 'default_casual') defaultCasualCount += 1;
    }
    if (followupIntent && followupIntent !== 'none') {
      followupIntentSeenCount += 1;
      const followupResolved = directAnswerApplied
        || clarifySuppressed
        || followupCarryFromHistory
        || repetitionPrevented
        || (contextCarryScore !== null && contextCarryScore >= 0.55);
      if (followupResolved) followupResolvedCount += 1;
    }
    if (typeof row.contextResumeDomain === 'string' && row.contextResumeDomain.trim()) {
      contextResumeSeenCount += 1;
      const contextResumeHandled = conversationMode === 'concierge'
        || routerReason === 'contextual_domain_resume'
        || followupCarryFromHistory
        || directAnswerApplied
        || (contextCarryScore !== null && contextCarryScore >= 0.6);
      if (contextResumeHandled) contextResumeHandledCount += 1;
    }
    if (repeatRiskScore !== null && repeatRiskScore >= 0.55) {
      recoveryRiskSeenCount += 1;
      if (misunderstandingRecovered || repetitionPrevented || directAnswerApplied || clarifySuppressed || followupCarryFromHistory || recoverySignal) {
        recoveryHandledCount += 1;
      }
    }
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
    if (contextCarryScore !== null) {
      contextCarryScoreTotal += contextCarryScore;
      contextCarryScoreCount += 1;
    }
    if (repeatRiskScore !== null) {
      repeatRiskScoreTotal += repeatRiskScore;
      repeatRiskScoreCount += 1;
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
    followupQuestionIncludedRate: followupQuestionIncludedSeenCount > 0
      ? Math.round((followupQuestionIncludedCount / followupQuestionIncludedSeenCount) * 10000) / 10000
      : 0,
    pitfallIncludedRate: pitfallIncludedSeenCount > 0
      ? Math.round((pitfallIncludedCount / pitfallIncludedSeenCount) * 10000) / 10000
      : 0,
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
    followupIntentReasons: sortCountEntries(followupIntentReasons, 'followupIntentReason', 10),
    routerReasons: sortCountEntries(routerReasons, 'routerReason', 12),
    parentIntentTypes: sortCountEntries(parentIntentTypes, 'parentIntentType', 12),
    parentAnswerModes: sortCountEntries(parentAnswerModes, 'parentAnswerMode', 12),
    parentLifecycleStages: sortCountEntries(parentLifecycleStages, 'parentLifecycleStage', 12),
    parentChapters: sortCountEntries(parentChapters, 'parentChapter', 12),
    parentRoutingInvariantStatuses: sortCountEntries(parentRoutingInvariantStatuses, 'parentRoutingInvariantStatus', 8),
    avgUnsupportedClaimCount: sampleCount > 0
      ? Math.round((unsupportedClaimCountTotal / sampleCount) * 10000) / 10000
      : 0,
    contradictionDetectedRate: sampleCount > 0
      ? Math.round((contradictionDetectedCount / sampleCount) * 10000) / 10000
      : 0,
    conciseModeAppliedRate: conciseModeAppliedSeenCount > 0
      ? Math.round((conciseModeAppliedCount / conciseModeAppliedSeenCount) * 10000) / 10000
      : 0,
    repetitionPreventedRate: repetitionPreventedSeenCount > 0
      ? Math.round((repetitionPreventedCount / repetitionPreventedSeenCount) * 10000) / 10000
      : 0,
    directAnswerAppliedRate: directAnswerAppliedSeenCount > 0
      ? Math.round((directAnswerAppliedCount / directAnswerAppliedSeenCount) * 10000) / 10000
      : 0,
    clarifySuppressedRate: clarifySuppressedSeenCount > 0
      ? Math.round((clarifySuppressedCount / clarifySuppressedSeenCount) * 10000) / 10000
      : 0,
    avgContextCarryScore: contextCarryScoreCount > 0
      ? Math.round((contextCarryScoreTotal / contextCarryScoreCount) * 10000) / 10000
      : 0,
    avgRepeatRiskScore: repeatRiskScoreCount > 0
      ? Math.round((repeatRiskScoreTotal / repeatRiskScoreCount) * 10000) / 10000
      : 0,
    followupResolutionRate: followupIntentSeenCount > 0
      ? Math.round((followupResolvedCount / followupIntentSeenCount) * 10000) / 10000
      : 0,
    followupCarryFromHistoryRate: followupCarryFromHistorySeenCount > 0
      ? Math.round((followupCarryFromHistoryCount / followupCarryFromHistorySeenCount) * 10000) / 10000
      : 0,
    contextualResumeHandledRate: contextResumeSeenCount > 0
      ? Math.round((contextResumeHandledCount / contextResumeSeenCount) * 10000) / 10000
      : 0,
    recoverySignalRate: recoverySignalSeenCount > 0
      ? Math.round((recoverySignalCount / recoverySignalSeenCount) * 10000) / 10000
      : 0,
    misunderstandingRecoveredRate: misunderstandingRecoveredSeenCount > 0
      ? Math.round((misunderstandingRecoveredCount / misunderstandingRecoveredSeenCount) * 10000) / 10000
      : 0,
    requiredCoreFactsCompleteRate: requiredCoreFactsSeenCount > 0
      ? Math.round((requiredCoreFactsCompleteCount / requiredCoreFactsSeenCount) * 10000) / 10000
      : 0,
    avgMissingRequiredCoreFactsCount: sampleCount > 0
      ? Math.round((requiredCoreFactsMissingCountTotal / sampleCount) * 10000) / 10000
      : 0,
    avgRequiredCoreFactsCriticalMissingCount: sampleCount > 0
      ? Math.round((requiredCoreFactsCriticalMissingCountTotal / sampleCount) * 10000) / 10000
      : 0,
    requiredCoreFactsGateDecisions: sortCountEntries(requiredCoreFactsGateDecisions, 'requiredCoreFactsGateDecision', 8),
    recoveryHandledRate: recoveryRiskSeenCount > 0
      ? Math.round((recoveryHandledCount / recoveryRiskSeenCount) * 10000) / 10000
      : 0,
    defaultCasualRate: defaultCasualSeenCount > 0
      ? Math.round((defaultCasualCount / defaultCasualSeenCount) * 10000) / 10000
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

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return 0;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return Math.round(num * 10000) / 10000;
}

function percentile(values, pct) {
  const rows = Array.isArray(values)
    ? values.map((value) => Number(value)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b)
    : [];
  if (!rows.length) return 0;
  const rank = Math.max(0, Math.min(rows.length - 1, Math.ceil((pct / 100) * rows.length) - 1));
  return rows[rank];
}

function pickMaxContaminationRisk(rows) {
  const priorities = { low: 1, medium: 2, high: 3 };
  let selected = 'low';
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const risk = normalizeReason(row && row.contaminationRisk).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(priorities, risk)) return;
    if (priorities[risk] > priorities[selected]) selected = risk;
  });
  return selected;
}

function averageFromRows(rows, selector) {
  const values = [];
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    const value = Number(selector(row));
    if (!Number.isFinite(value)) return;
    values.push(value);
  });
  if (!values.length) return 0;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10000) / 10000;
}

function incrementCount(map, key) {
  const normalized = normalizeReason(key);
  map.set(normalized, (map.get(normalized) || 0) + 1);
}

function toTopSignals(map, limit) {
  return Array.from(map.entries())
    .map(([signal, count]) => ({ signal, count }))
    .sort((a, b) => b.count - a.count || a.signal.localeCompare(b.signal, 'ja'))
    .slice(0, limit);
}

function buildTopQualityBoards(actionRows, hardFailures) {
  const rows = Array.isArray(actionRows) ? actionRows : [];
  const qualityFailures = (Array.isArray(hardFailures) ? hardFailures : []).slice(0, 10).map((failure, index) => ({
    rank: index + 1,
    failure
  }));

  const loopMap = new Map();
  const contextLossMap = new Map();
  const jpServiceMap = new Map();
  const lineFitMap = new Map();

  rows.forEach((row) => {
    const routerReason = normalizeReason(row && row.routerReason);
    const conversationMode = normalizeReason(row && row.conversationMode);
    const domainIntent = normalizeReason(row && row.domainIntent);
    const followupIntent = normalizeReason(row && row.followupIntent);
    const strategy = normalizeReason(row && row.strategy);
    const retrievalQuality = normalizeReason(row && row.retrievalQuality);
    const directAnswerApplied = row && row.directAnswerApplied === true;
    const clarifySuppressed = row && row.clarifySuppressed === true;
    const contextCarryScore = Number.isFinite(Number(row && row.contextCarryScore)) ? Number(row.contextCarryScore) : 0;

    if (row && row.legacyTemplateHit === true) incrementCount(loopMap, 'legacy_template_hit');
    if (row && row.repetitionPrevented !== true) incrementCount(loopMap, 'repetition_not_prevented');
    if (routerReason === 'default_casual') incrementCount(loopMap, 'router_default_casual');
    if (!directAnswerApplied && followupIntent !== 'none') incrementCount(loopMap, 'followup_without_direct_answer');

    if (domainIntent !== 'general' && conversationMode === 'casual') incrementCount(contextLossMap, 'domain_to_casual_reset');
    if (followupIntent === 'none' && domainIntent !== 'general') incrementCount(contextLossMap, 'missing_followup_intent_on_domain');
    if (strategy === 'casual' && domainIntent !== 'general') incrementCount(contextLossMap, 'casual_strategy_under_domain');
    if (contextCarryScore < 0.35 && domainIntent !== 'general') incrementCount(contextLossMap, 'low_context_carry_score');

    if (row && row.conciseModeApplied !== true) incrementCount(jpServiceMap, 'concise_mode_not_applied');
    if (row && row.followupQuestionIncluded !== true) incrementCount(jpServiceMap, 'followup_question_missing');
    if (row && row.pitfallIncluded !== true) incrementCount(jpServiceMap, 'pitfall_missing');
    if (!clarifySuppressed && followupIntent !== 'none') incrementCount(jpServiceMap, 'clarify_not_suppressed_for_followup');

    if (row && row.retrieveNeeded === true && conversationMode === 'casual') incrementCount(lineFitMap, 'retrieval_used_in_casual');
    if (row && Number.isFinite(Number(row.actionCount)) && Number(row.actionCount) > 3) incrementCount(lineFitMap, 'action_count_over_budget');
    if (retrievalQuality === 'bad') incrementCount(lineFitMap, 'bad_retrieval_quality');
  });

  return {
    topQualityFailures: qualityFailures,
    topLoopCases: toTopSignals(loopMap, 10),
    topContextLossCases: toTopSignals(contextLossMap, 10),
    topJapaneseServiceFailures: toTopSignals(jpServiceMap, 10),
    topLineFitFailures: toTopSignals(lineFitMap, 10)
  };
}

function buildCounterexampleQueueFromBoards(boards) {
  const data = boards && typeof boards === 'object' ? boards : {};
  const entries = [];
  (Array.isArray(data.topQualityFailures) ? data.topQualityFailures : []).forEach((row, index) => {
    const signal = normalizeReason(row && row.failure);
    if (signal === 'none') return;
    entries.push({
      category: 'quality_failure',
      signal,
      rank: index + 1,
      severity: 'high',
      count: 1
    });
  });
  (Array.isArray(data.topLoopCases) ? data.topLoopCases : []).forEach((row, index) => {
    const signal = normalizeReason(row && row.signal);
    if (signal === 'none') return;
    entries.push({
      category: 'loop_case',
      signal,
      rank: index + 1,
      severity: 'high',
      count: Number(row && row.count) || 1
    });
  });
  (Array.isArray(data.topContextLossCases) ? data.topContextLossCases : []).forEach((row, index) => {
    const signal = normalizeReason(row && row.signal);
    if (signal === 'none') return;
    entries.push({
      category: 'context_loss_case',
      signal,
      rank: index + 1,
      severity: 'high',
      count: Number(row && row.count) || 1
    });
  });
  (Array.isArray(data.topJapaneseServiceFailures) ? data.topJapaneseServiceFailures : []).forEach((row, index) => {
    const signal = normalizeReason(row && row.signal);
    if (signal === 'none') return;
    entries.push({
      category: 'jp_service_failure',
      signal,
      rank: index + 1,
      severity: 'medium',
      count: Number(row && row.count) || 1
    });
  });
  (Array.isArray(data.topLineFitFailures) ? data.topLineFitFailures : []).forEach((row, index) => {
    const signal = normalizeReason(row && row.signal);
    if (signal === 'none') return;
    entries.push({
      category: 'line_fit_failure',
      signal,
      rank: index + 1,
      severity: 'medium',
      count: Number(row && row.count) || 1
    });
  });
  return buildCounterexampleQueueFromSignalEntries(entries, { limit: 10 });
}

function countWhere(rows, predicate) {
  let total = 0;
  (Array.isArray(rows) ? rows : []).forEach((row) => {
    if (predicate(row)) total += 1;
  });
  return total;
}

function buildRateMetric(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sampleCount = Number.isFinite(Number(payload.sampleCount)) ? Number(payload.sampleCount) : 0;
  const rawValue = Number(payload.value);
  const threshold = payload.threshold && typeof payload.threshold === 'object' ? payload.threshold : {};
  if (sampleCount <= 0 || !Number.isFinite(rawValue)) {
    return {
      key: payload.key || 'unknown',
      value: null,
      sampleCount,
      status: 'missing',
      operator: threshold.operator || null,
      threshold: threshold.value !== undefined ? threshold.value : null,
      note: payload.note || 'measurement_missing'
    };
  }
  let status = 'pass';
  if (threshold.operator === 'min' && rawValue < Number(threshold.value)) status = 'fail';
  else if (threshold.operator === 'max' && rawValue > Number(threshold.value)) status = 'fail';
  else if (threshold.operator === 'exact' && rawValue !== Number(threshold.value)) status = 'fail';
  if (status === 'pass' && threshold.warnAbove !== undefined && rawValue > Number(threshold.warnAbove)) status = 'warning';
  return {
    key: payload.key || 'unknown',
    value: Math.round(rawValue * 10000) / 10000,
    sampleCount,
    status,
    operator: threshold.operator || null,
    threshold: threshold.value !== undefined ? threshold.value : null,
    note: payload.note || null
  };
}

function buildDurationMetric(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sampleCount = Number.isFinite(Number(payload.sampleCount)) ? Number(payload.sampleCount) : 0;
  const rawValue = Number(payload.value);
  const threshold = payload.threshold && typeof payload.threshold === 'object' ? payload.threshold : {};
  if (sampleCount <= 0 || !Number.isFinite(rawValue)) {
    return {
      key: payload.key || 'unknown',
      valueMs: null,
      sampleCount,
      status: 'missing',
      operator: threshold.operator || null,
      thresholdMs: threshold.value !== undefined ? threshold.value : null,
      note: payload.note || 'measurement_missing'
    };
  }
  const status = threshold.operator === 'max' && rawValue > Number(threshold.value) ? 'fail' : 'pass';
  return {
    key: payload.key || 'unknown',
    valueMs: Math.round(rawValue),
    sampleCount,
    status,
    operator: threshold.operator || null,
    thresholdMs: threshold.value !== undefined ? threshold.value : null,
    note: payload.note || null
  };
}

function buildQualityLoopV2Summary(data) {
  const payload = data && typeof data === 'object' ? data : {};
  const actionRows = Array.isArray(payload.actionRows) ? payload.actionRows : [];
  const traceSearchAuditRows = Array.isArray(payload.traceSearchAuditRows) ? payload.traceSearchAuditRows : [];
  const conversation = payload.conversationQuality && typeof payload.conversationQuality === 'object' ? payload.conversationQuality : {};
  const optimization = payload.optimization && typeof payload.optimization === 'object' ? payload.optimization : {};

  const cityPackRows = actionRows.filter((row) => row && (
    row.cityPackGrounded === true
    || Number(row.cityPackFreshnessScore) > 0
    || Number(row.cityPackAuthorityScore) > 0
  ));
  const staleRows = actionRows.filter((row) => row && (
    Number(row.cityPackFreshnessScore) > 0 && Number(row.cityPackFreshnessScore) < 0.6
      || Number(row.sourceFreshnessScore) > 0 && Number(row.sourceFreshnessScore) < 0.6
  ));
  const emergencyRows = actionRows.filter((row) => row && row.emergencyContextActive === true);
  const highRiskRows = actionRows.filter((row) => normalizeReason(row && row.intentRiskTier).toLowerCase() === 'high');
  const journeyRows = actionRows.filter((row) => row && (
    row.taskBlockerDetected === true
    || normalizeReason(row.journeyPhase).toLowerCase() !== 'none'
  ));
  const blockerRows = actionRows.filter((row) => row && row.taskBlockerDetected === true);
  const savedFaqRows = actionRows.filter((row) => row && row.savedFaqReused === true);
  const crossSystemRows = actionRows.filter((row) => row && Object.prototype.hasOwnProperty.call(row, 'crossSystemConflictDetected'));
  const readinessV2Rows = actionRows.filter((row) => row && normalizeReason(row.answerReadinessVersion).toLowerCase() === 'v2');
  const traceJoinRows = traceSearchAuditRows.filter((row) => row && Number.isFinite(Number(row.traceJoinCompleteness)));
  const traceResolutionRows = traceSearchAuditRows.filter((row) => row && Number.isFinite(Number(row.adminTraceResolutionTimeMs)));

  const cityPackGroundingRate = buildRateMetric({
    key: 'cityPackGroundingRate',
    value: cityPackRows.length > 0
      ? countWhere(cityPackRows, (row) => row.cityPackGrounded === true
        && (Number(row.cityPackFreshnessScore) <= 0 || Number(row.cityPackFreshnessScore) >= 0.6)
        && (Number(row.cityPackAuthorityScore) <= 0 || Number(row.cityPackAuthorityScore) >= 0.6)) / cityPackRows.length
      : null,
    sampleCount: cityPackRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.cityPackGroundingRate }
  });
  const staleSourceBlockRate = buildRateMetric({
    key: 'staleSourceBlockRate',
    value: staleRows.length > 0
      ? countWhere(staleRows, (row) => ['hedged', 'clarify', 'refuse'].includes(normalizeReason(row.readinessDecisionV2 || row.sourceReadinessDecision || row.readinessDecision).toLowerCase())) / staleRows.length
      : null,
    sampleCount: staleRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.staleSourceBlockRate }
  });
  const emergencyOfficialSourceRate = buildRateMetric({
    key: 'emergencyOfficialSourceRate',
    value: emergencyRows.length > 0
      ? countWhere(emergencyRows, (row) => row.emergencyOfficialSourceSatisfied === true) / emergencyRows.length
      : null,
    sampleCount: emergencyRows.length,
    threshold: { operator: 'exact', value: QUALITY_LOOP_V2_THRESHOLDS.emergencyOfficialSourceRate }
  });
  const journeyAlignedActionRate = buildRateMetric({
    key: 'journeyAlignedActionRate',
    value: journeyRows.length > 0
      ? countWhere(journeyRows, (row) => row.journeyAlignedAction === true) / journeyRows.length
      : null,
    sampleCount: journeyRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.journeyAlignedActionRate }
  });
  const taskBlockerConflictRate = buildRateMetric({
    key: 'taskBlockerConflictRate',
    value: blockerRows.length > 0
      ? countWhere(blockerRows, (row) => row.journeyAlignedAction !== true) / blockerRows.length
      : null,
    sampleCount: blockerRows.length,
    threshold: { operator: 'max', value: QUALITY_LOOP_V2_THRESHOLDS.taskBlockerConflictRate }
  });
  const savedFaqReusePassRate = buildRateMetric({
    key: 'savedFaqReusePassRate',
    value: savedFaqRows.length > 0
      ? countWhere(savedFaqRows, (row) => row.savedFaqReusePass === true) / savedFaqRows.length
      : null,
    sampleCount: savedFaqRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.savedFaqReusePassRate }
  });
  const crossSystemConflictRate = buildRateMetric({
    key: 'crossSystemConflictRate',
    value: crossSystemRows.length > 0
      ? countWhere(crossSystemRows, (row) => row.crossSystemConflictDetected === true) / crossSystemRows.length
      : null,
    sampleCount: crossSystemRows.length,
    threshold: { operator: 'max', value: 1, warnAbove: QUALITY_LOOP_V2_THRESHOLDS.crossSystemConflictWarningRate },
    note: 'review_on_spike'
  });
  const officialSourceUsageRateHighRisk = buildRateMetric({
    key: 'officialSourceUsageRateHighRisk',
    value: highRiskRows.length > 0
      ? countWhere(highRiskRows, (row) => row.officialOnlySatisfied === true) / highRiskRows.length
      : null,
    sampleCount: highRiskRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.officialSourceUsageRateHighRisk }
  });
  const compatShareWindow = buildRateMetric({
    key: 'compatShareWindow',
    value: Number.isFinite(Number(optimization.compatShareWindow)) ? Number(optimization.compatShareWindow) : null,
    sampleCount: Number(conversation.sampleCount || 0),
    threshold: { operator: 'max', value: QUALITY_LOOP_V2_THRESHOLDS.compatShareWindow }
  });
  const emergencyOverrideAppliedRate = buildRateMetric({
    key: 'emergencyOverrideAppliedRate',
    value: null,
    sampleCount: emergencyRows.length,
    threshold: { operator: 'min', value: 0 },
    note: 'pending_emergency_override_wiring'
  });
  const traceJoinCompleteness = buildRateMetric({
    key: 'traceJoinCompleteness',
    value: traceJoinRows.length > 0 ? averageFromRows(traceJoinRows, (row) => row && row.traceJoinCompleteness) : null,
    sampleCount: traceJoinRows.length,
    threshold: { operator: 'min', value: QUALITY_LOOP_V2_THRESHOLDS.traceJoinCompleteness },
    note: traceJoinRows.length > 0 ? null : 'pending_cross_system_trace_join'
  });
  const adminTraceResolutionTime = buildDurationMetric({
    key: 'adminTraceResolutionTime',
    value: traceResolutionRows.length > 0 ? averageFromRows(traceResolutionRows, (row) => row && row.adminTraceResolutionTimeMs) : null,
    sampleCount: traceResolutionRows.length,
    threshold: { operator: 'max', value: QUALITY_LOOP_V2_THRESHOLDS.adminTraceResolutionTimeMsStg },
    note: traceResolutionRows.length > 0 ? null : 'pending_operator_trace_latency_wiring'
  });
  const directUrlLeakage = buildRateMetric({
    key: 'directUrlLeakage',
    value: null,
    sampleCount: 0,
    threshold: { operator: 'exact', value: 0 },
    note: 'pending_direct_url_runtime_signal'
  });

  const integrationKpis = {
    cityPackGroundingRate,
    staleSourceBlockRate,
    emergencyOfficialSourceRate,
    emergencyOverrideAppliedRate,
    journeyAlignedActionRate,
    taskBlockerConflictRate,
    savedFaqReusePassRate,
    crossSystemConflictRate,
    traceJoinCompleteness,
    adminTraceResolutionTime,
    officialSourceUsageRateHighRisk,
    compatShareWindow,
    directUrlLeakage
  };
  const missingMeasurements = Object.values(integrationKpis)
    .filter((row) => row && row.status === 'missing')
    .map((row) => row.key);

  const criticalSlices = [
    { sliceKey: 'emergency_high_risk', status: emergencyOfficialSourceRate.status, blocked: emergencyOfficialSourceRate.status === 'fail', sourceMetric: 'emergencyOfficialSourceRate' },
    { sliceKey: 'saved_faq_high_risk_reuse', status: savedFaqReusePassRate.status, blocked: savedFaqReusePassRate.status === 'fail', sourceMetric: 'savedFaqReusePassRate' },
    { sliceKey: 'journey_blocker_conflict', status: taskBlockerConflictRate.status, blocked: taskBlockerConflictRate.status === 'fail', sourceMetric: 'taskBlockerConflictRate' },
    { sliceKey: 'stale_city_pack_required_source', status: staleSourceBlockRate.status, blocked: staleSourceBlockRate.status === 'fail', sourceMetric: 'staleSourceBlockRate' },
    { sliceKey: 'compat_spike', status: compatShareWindow.status, blocked: compatShareWindow.status === 'fail', sourceMetric: 'compatShareWindow' },
    { sliceKey: 'trace_join_incomplete', status: traceJoinCompleteness.status, blocked: traceJoinCompleteness.status !== 'pass', sourceMetric: 'traceJoinCompleteness' },
    { sliceKey: 'direct_url_leakage', status: directUrlLeakage.status, blocked: directUrlLeakage.status !== 'pass', sourceMetric: 'directUrlLeakage' },
    { sliceKey: 'official_source_missing_on_high_risk', status: officialSourceUsageRateHighRisk.status, blocked: officialSourceUsageRateHighRisk.status === 'fail', sourceMetric: 'officialSourceUsageRateHighRisk' }
  ];

  const readinessDecisionV2Breakdown = new Map();
  const readinessModeBreakdown = new Map();
  const readinessStageBreakdown = new Map();
  readinessV2Rows.forEach((row) => {
    incrementCount(readinessDecisionV2Breakdown, row && row.readinessDecisionV2 ? row.readinessDecisionV2 : 'none');
    incrementCount(readinessModeBreakdown, row && row.answerReadinessV2Mode ? row.answerReadinessV2Mode : 'unknown');
    incrementCount(readinessStageBreakdown, row && row.answerReadinessV2Stage ? row.answerReadinessV2Stage : 'unknown');
  });
  const nogoGateMandatoryCount = countWhere(readinessV2Rows, (row) => row && row.answerReadinessV2Stage === 'nogo_gate_mandatory');
  const hardEnforcedCount = countWhere(
    readinessV2Rows,
    (row) => row && (row.answerReadinessV2Stage === 'hard_enforcement' || row.answerReadinessV2Stage === 'nogo_gate_mandatory')
  );
  const softEnforcedCount = countWhere(readinessV2Rows, (row) => row && row.answerReadinessEnforcedV2 === true && row.answerReadinessV2Stage === 'soft_enforcement');
  const logOnlyCount = countWhere(readinessV2Rows, (row) => row && row.answerReadinessLogOnlyV2 === true);
  let rolloutStage = 'design_only';
  if (nogoGateMandatoryCount > 0) {
    rolloutStage = 'nogo_gate_mandatory';
  } else if (hardEnforcedCount > 0) {
    rolloutStage = 'hard_enforcement';
  } else if (softEnforcedCount > 0) {
    rolloutStage = 'soft_enforcement';
  } else if (readinessV2Rows.length > 0) {
    rolloutStage = 'log_only';
  }
  const criticalSliceFailCount = criticalSlices.filter((row) => row && row.status !== 'pass').length;

  return {
    version: 'v2-foundation',
    rolloutStage,
    nogoGateMandatoryActive: rolloutStage === 'nogo_gate_mandatory',
    crossSystemPriorityOrder: QUALITY_LOOP_V2_PRIORITY_ORDER.slice(),
    criticalSliceKeys: QUALITY_LOOP_V2_CRITICAL_SLICES.slice(),
    criticalSlices,
    criticalSliceFailCount,
    integrationKpis,
    readinessV2: {
      sampleCount: readinessV2Rows.length,
      versionObserved: readinessV2Rows.length > 0 ? 'v2' : 'none',
      decisionBreakdown: sortCountEntries(readinessDecisionV2Breakdown, 'decision', 10),
      modeBreakdown: sortCountEntries(readinessModeBreakdown, 'mode', 10),
      stageBreakdown: sortCountEntries(readinessStageBreakdown, 'stage', 10),
      hardEnforcedCount,
      softEnforcedCount,
      logOnlyCount,
      nogoGateMandatoryCount
    },
    missingJoins: missingMeasurements.slice(),
    reservations: QUALITY_LOOP_V2_RESERVATIONS.slice()
  };
}

function buildImprovementLoopSummary(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const qualityLoopV2 = data.qualityLoopV2 && typeof data.qualityLoopV2 === 'object' ? data.qualityLoopV2 : {};
  const actionRows = Array.isArray(data.actionRows) ? data.actionRows : [];
  const traceSearchAuditRows = Array.isArray(data.traceSearchAuditRows) ? data.traceSearchAuditRows : [];
  const hardFailures = Array.isArray(data.hardFailures) ? data.hardFailures : [];
  const topQualityFailures = Array.isArray(data.topQualityFailures) ? data.topQualityFailures : [];
  const topLoopCases = Array.isArray(data.topLoopCases) ? data.topLoopCases : [];
  const topContextLossCases = Array.isArray(data.topContextLossCases) ? data.topContextLossCases : [];

  const signalEntries = [];
  const integrationKpis = qualityLoopV2.integrationKpis && typeof qualityLoopV2.integrationKpis === 'object'
    ? qualityLoopV2.integrationKpis
    : {};
  const criticalSlices = Array.isArray(qualityLoopV2.criticalSlices) ? qualityLoopV2.criticalSlices : [];
  const missingMeasurements = Array.isArray(qualityLoopV2.missingJoins) ? qualityLoopV2.missingJoins : [];
  const runtimeAudit = qualityLoopV2.runtimeAudit && typeof qualityLoopV2.runtimeAudit === 'object'
    ? qualityLoopV2.runtimeAudit
    : {};
  const runtimeAuditUnavailable = runtimeAudit.runtimeAuditUnavailable === true;

  const pushSignal = (category, severity, signal) => {
    if (!signal) return;
    signalEntries.push({
      category,
      severity,
      signals: [{ signal }]
    });
  };

  if (runtimeAuditUnavailable) {
    pushSignal('telemetry', 'high', 'runtimeAuditUnavailable');
  }

  criticalSlices
    .filter((row) => row && row.status !== 'pass')
    .forEach((row) => {
      const signal = row && row.sourceMetric ? row.sourceMetric : row.sliceKey;
      if (signal === 'compatShareWindow') pushSignal('router', 'high', signal);
      else if (signal === 'traceJoinCompleteness' || signal === 'adminTraceResolutionTime') pushSignal('telemetry', 'high', signal);
      else if (['cityPackGroundingRate', 'staleSourceBlockRate', 'savedFaqReusePassRate'].includes(signal)) pushSignal('knowledge', 'high', signal);
      else if (['emergencyOfficialSourceRate', 'emergencyOverrideAppliedRate', 'journeyAlignedActionRate', 'taskBlockerConflictRate'].includes(signal)) pushSignal('integration', 'high', signal);
      else if (signal === 'officialSourceUsageRateHighRisk') pushSignal('policy', 'high', 'officialSourceUsageRate');
    });

  missingMeasurements.forEach((signal) => {
    if (signal === 'traceJoinCompleteness' || signal === 'adminTraceResolutionTime') pushSignal('telemetry', 'medium', signal);
    else if (['cityPackGroundingRate', 'savedFaqReusePassRate', 'staleSourceBlockRate'].includes(signal)) pushSignal('knowledge', 'medium', signal);
    else if (signal === 'compatShareWindow') pushSignal('router', 'medium', signal);
    else pushSignal('integration', 'medium', signal);
  });

  Object.entries(integrationKpis).forEach(([key, row]) => {
    if (!row || row.status === 'pass' || row.status === 'missing') return;
    const severity = row.status === 'fail' ? 'high' : 'medium';
    if (key === 'compatShareWindow') pushSignal('router', severity, key);
    else if (key === 'officialSourceUsageRateHighRisk') pushSignal('policy', severity, 'officialSourceUsageRate');
    else if (key === 'traceJoinCompleteness' || key === 'adminTraceResolutionTime') pushSignal('telemetry', severity, key);
    else if (['cityPackGroundingRate', 'savedFaqReusePassRate', 'staleSourceBlockRate'].includes(key)) pushSignal('knowledge', severity, key);
    else pushSignal('integration', severity, key);
  });

  hardFailures.forEach((failure) => {
    const text = normalizeReason(failure);
    if (text.includes('contradiction') || text.includes('unsupported') || text.includes('readiness')) pushSignal('readiness', 'high', text);
    else if (text.includes('compat')) pushSignal('router', 'high', text);
    else if (text.includes('policy') || text.includes('official')) pushSignal('policy', 'high', text);
  });

  topLoopCases.slice(0, 2).forEach((row) => pushSignal('router', 'medium', row && row.signal));
  topContextLossCases.slice(0, 2).forEach((row) => pushSignal('integration', 'medium', row && row.signal));
  topQualityFailures.slice(0, 2).forEach((row) => pushSignal('readiness', 'medium', row && row.failure));

  const improvementBacklog = buildBacklogRowsFromSignals(signalEntries, { limit: 5 });
  const topFailures = Array.from(new Set(signalEntries.flatMap((row) => (Array.isArray(row.signals) ? row.signals.map((item) => item && item.signal).filter(Boolean) : []))))
    .slice(0, 5)
    .map((signal) => ({ signal }));

  const sampleCount = actionRows.length + traceSearchAuditRows.length;
  let qualityLoopStatus = 'ok';
  if (runtimeAuditUnavailable) qualityLoopStatus = 'action_required';
  else if (sampleCount <= 0) qualityLoopStatus = 'missing';
  else if ((qualityLoopV2.criticalSliceFailCount || 0) > 0 || hardFailures.length > 0) qualityLoopStatus = 'action_required';
  else if (missingMeasurements.length > 0 || topFailures.length > 0) qualityLoopStatus = 'warning';

  const lastAuditAt = [actionRows, traceSearchAuditRows]
    .flat()
    .reduce((latest, row) => {
      const value = toMillis(row && row.createdAt ? row.createdAt : null);
      if (!Number.isFinite(value)) return latest;
      return latest === null || value > latest ? value : latest;
    }, null);

  return {
    qualityLoopStatus,
    lastAuditAt: lastAuditAt === null ? null : new Date(lastAuditAt).toISOString(),
    runtimeAuditUnavailable,
    runtimeAuditStatus: runtimeAudit.status || (runtimeAuditUnavailable ? 'action_required' : (sampleCount > 0 ? 'ok' : 'missing')),
    runtimeFetchStatus: runtimeAudit.runtimeFetchStatus || (runtimeAuditUnavailable ? 'unavailable' : (sampleCount > 0 ? 'ok' : 'missing')),
    runtimeFetchErrorCode: runtimeAudit.runtimeFetchErrorCode || null,
    runtimeFetchErrorMessage: runtimeAudit.runtimeFetchErrorMessage || null,
    recoveryActionCode: runtimeAudit.recoveryActionCode || null,
    recoveryCommands: Array.isArray(runtimeAudit.recoveryCommands) ? runtimeAudit.recoveryCommands.slice(0, 5) : [],
    topFailures: topFailures.slice(0, 5),
    improvementBacklog: improvementBacklog.slice(0, 5)
  };
}

function buildTraceSearchAuditRows(auditRows) {
  return (Array.isArray(auditRows) ? auditRows : []).map((row) => {
    const summary = row && row.payloadSummary && typeof row.payloadSummary === 'object' ? row.payloadSummary : {};
    return {
      traceJoinCompleteness: Number(summary.traceJoinCompleteness),
      adminTraceResolutionTimeMs: Number(summary.adminTraceResolutionTimeMs),
      traceBundleLoadMs: Number(summary.traceBundleLoadMs),
      joinedDomainCount: Number(summary.joinedDomainCount),
      missingDomainCount: Number(summary.missingDomainCount),
      joinedDomains: Array.isArray(summary.joinedDomains) ? summary.joinedDomains.slice() : [],
      missingDomains: Array.isArray(summary.missingDomains) ? summary.missingDomains.slice() : [],
      createdAt: row && row.createdAt ? row.createdAt : null
    };
  }).filter((row) => Number.isFinite(row.traceJoinCompleteness) || Number.isFinite(row.adminTraceResolutionTimeMs));
}

function buildQualityFrameworkSummary(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const conversation = data.conversationQuality && typeof data.conversationQuality === 'object' ? data.conversationQuality : {};
  const gate = data.gateAuditBaseline && typeof data.gateAuditBaseline === 'object' ? data.gateAuditBaseline : {};
  const byPlan = data.byPlan && typeof data.byPlan === 'object' ? data.byPlan : {};
  const releaseReadiness = data.releaseReadiness && typeof data.releaseReadiness === 'object' ? data.releaseReadiness : {};
  const actionRows = Array.isArray(data.actionRows) ? data.actionRows : [];
  const baselineOverall = Number.isFinite(Number(data.baselineOverallScore)) ? Number(data.baselineOverallScore) : 54.9;

  const directUrlRate = 0;
  const legacyTemplateHitRate = clamp01(conversation.legacyTemplateHitRate);
  const defaultCasualRate = clamp01(conversation.defaultCasualRate);
  const contradictionRate = clamp01(conversation.contradictionRate);
  const acceptedRate = clamp01(gate.acceptedRate);
  const sourceAuthority = clamp01(conversation.avgSourceAuthorityScore);
  const sourceFreshness = clamp01(conversation.avgSourceFreshnessScore);
  const evidenceCoverage = clamp01((releaseReadiness.metrics && releaseReadiness.metrics.avgEvidenceCoverage) || 0);
  const conciseRate = clamp01(conversation.conciseModeAppliedRate);
  const repetitionPreventedRate = clamp01(conversation.repetitionPreventedRate);
  const directAnswerRate = clamp01(conversation.directAnswerAppliedRate);
  const clarifySuppressedRate = clamp01(conversation.clarifySuppressedRate);
  const contextCarryScore = clamp01(conversation.avgContextCarryScore);
  const repeatRiskScore = clamp01(conversation.avgRepeatRiskScore);
  const followupRate = clamp01(conversation.followupQuestionIncludedRate);
  const followupResolutionRate = clamp01(conversation.followupResolutionRate);
  const followupCarryFromHistoryRate = clamp01(conversation.followupCarryFromHistoryRate);
  const contextualResumeHandledRate = clamp01(conversation.contextualResumeHandledRate);
  const recoverySignalRate = clamp01(conversation.recoverySignalRate);
  const misunderstandingRecoveredRate = clamp01(conversation.misunderstandingRecoveredRate);
  const recoveryHandledRate = clamp01(conversation.recoveryHandledRate);
  const domainConciergeRate = clamp01(conversation.domainIntentConciergeRate);
  const unsupportedClaims = clamp01(1 - Math.min(1, Number(conversation.avgUnsupportedClaimCount || 0)));
  const officialOnlyRate = clamp01(conversation.officialOnlySatisfiedRate);
  const retrieveNeededRate = clamp01(conversation.retrieveNeededRate);
  const verifyClarifyCount = Array.isArray(conversation.verificationOutcomes)
    ? Number((conversation.verificationOutcomes.find((row) => row.verificationOutcome === 'clarify') || {}).count || 0)
    : 0;
  const verifyClarifyRate = clamp01(verifyClarifyCount / Math.max(1, Number(conversation.sampleCount || 0)));
  const safetyScore = clamp01(1 - contradictionRate);

  const dimensionMap = {
    factuality_grounding: clamp01((acceptedRate + (1 - contradictionRate)) / 2),
    source_authority_freshness: clamp01((sourceAuthority + sourceFreshness) / 2),
    procedural_utility: clamp01((domainConciergeRate + conciseRate + directAnswerRate) / 3),
    next_step_clarity: clamp01((conciseRate + followupRate + repetitionPreventedRate + directAnswerRate) / 4),
    conversation_continuity: clamp01(
      (
        1 - defaultCasualRate
        + domainConciergeRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + directAnswerRate
        + clarifySuppressedRate
        + followupResolutionRate
        + contextualResumeHandledRate
      ) / 8
    ),
    short_followup_understanding: clamp01((1 - defaultCasualRate + followupRate + contextCarryScore + directAnswerRate) / 4),
    clarification_quality: clamp01(
      (
        1 - Math.max(0, verifyClarifyRate - 0.3)
        + clarifySuppressedRate
        + directAnswerRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + followupResolutionRate
        + contextualResumeHandledRate
      ) / 7
    ),
    repetition_loop_avoidance: clamp01((1 - legacyTemplateHitRate + repetitionPreventedRate) / 2),
    direct_answer_first: clamp01((directAnswerRate + conciseRate) / 2),
    japanese_naturalness: clamp01(conciseRate),
    japanese_service_quality: clamp01((conciseRate + followupRate + (1 - legacyTemplateHitRate)) / 3),
    keigo_distance: clamp01(conciseRate),
    empathy: clamp01(
      (
        followupRate
        + conciseRate
        + directAnswerRate
        + contextCarryScore
        + followupCarryFromHistoryRate
        + followupResolutionRate
      ) / 6
    ),
    cultural_habit_fit: clamp01((followupRate + domainConciergeRate) / 2),
    line_native_fit: clamp01((conciseRate + directAnswerRate + (1 - retrieveNeededRate)) / 3),
    action_policy_compliance: clamp01(acceptedRate),
    safety_compliance_privacy: safetyScore,
    memory_integrity: clamp01((domainConciergeRate + (1 - defaultCasualRate)) / 2),
    group_chat_privacy: clamp01(1 - directUrlRate),
    minority_persona_robustness: clamp01((followupRate + unsupportedClaims) / 2),
    misunderstanding_recovery: clamp01(
      (
        misunderstandingRecoveredRate
        +
        repetitionPreventedRate
        + directAnswerRate
        + (1 - repeatRiskScore)
        + contextCarryScore
        + followupCarryFromHistoryRate
        + recoverySignalRate
        + recoveryHandledRate
        + followupResolutionRate
      ) / 9
    ),
    escalation_appropriateness: clamp01((officialOnlyRate + sourceAuthority) / 2),
    operational_reliability: clamp01(acceptedRate),
    latency_surface_efficiency: clamp01(
      (
        conciseRate
        + (1 - retrieveNeededRate)
        + (1 - repeatRiskScore)
        + directAnswerRate
        + followupCarryFromHistoryRate
        + contextualResumeHandledRate
      ) / 6
    )
  };

  const dimensions = QUALITY_DIMENSIONS.map((dim) => {
    const score = clamp01(dimensionMap[dim.key]);
    const threshold = dim.hardGate ? 0.82 : 0.7;
    const status = score >= threshold ? 'pass' : (dim.hardGate ? 'fail' : 'warning');
    return {
      key: dim.key,
      score,
      weight: dim.weight,
      hardGate: dim.hardGate,
      status
    };
  });
  const passDimensions = dimensions.filter((row) => row.status === 'pass');
  const warningDimensions = dimensions.filter((row) => row.status === 'warning');
  const failDimensions = dimensions.filter((row) => row.status === 'fail');
  const improvedDimensions = passDimensions
    .slice()
    .sort((left, right) => Number(right.score || 0) - Number(left.score || 0) || String(left.key).localeCompare(String(right.key), 'ja'))
    .slice(0, 6)
    .map((row) => row.key);
  const regressedDimensions = failDimensions
    .slice()
    .sort((left, right) => Number(left.score || 0) - Number(right.score || 0) || String(left.key).localeCompare(String(right.key), 'ja'))
    .slice(0, 6)
    .map((row) => row.key);
  const unmetCategories = dimensions
    .filter((row) => row.status !== 'pass')
    .map((row) => row.key);
  const categoryImprovementRate = dimensions.length > 0
    ? Math.round((passDimensions.length / dimensions.length) * 10000) / 10000
    : 0;
  const categoryRegressionRate = dimensions.length > 0
    ? Math.round((failDimensions.length / dimensions.length) * 10000) / 10000
    : 0;
  const entryAcceptedRateMap = new Map();
  (Array.isArray(gate.entryTypes) ? gate.entryTypes : []).forEach((row) => {
    const entryType = normalizeReason(row && row.entryType).toLowerCase();
    const accepted = Number.isFinite(Number(row && row.acceptedRate)) ? Number(row.acceptedRate) : null;
    if (!entryType || accepted === null) return;
    entryAcceptedRateMap.set(entryType, clamp01(accepted));
  });
  const entryQualitySignalMap = new Map();
  (Array.isArray(gate.entryQualitySignals) ? gate.entryQualitySignals : []).forEach((row) => {
    const entryType = normalizeReason(row && row.entryType).toLowerCase();
    if (!entryType) return;
    entryQualitySignalMap.set(entryType, {
      sampleCount: Number.isFinite(Number(row && row.sampleCount)) ? Number(row.sampleCount) : 0,
      legacyTemplateHitRate: clamp01(row && row.legacyTemplateHitRate),
      conciseModeAppliedRate: clamp01(row && row.conciseModeAppliedRate),
      directAnswerAppliedRate: clamp01(row && row.directAnswerAppliedRate),
      repetitionPreventedRate: clamp01(row && row.repetitionPreventedRate),
      clarifySuppressedRate: clamp01(row && row.clarifySuppressedRate),
      defaultCasualRate: clamp01(row && row.defaultCasualRate),
      followupQuestionIncludedRate: clamp01(row && row.followupQuestionIncludedRate),
      avgContextCarryScore: clamp01(row && row.avgContextCarryScore),
      avgRepeatRiskScore: clamp01(row && row.avgRepeatRiskScore)
    });
  });
  function resolveEntrySignals(entryType) {
    const key = normalizeReason(entryType).toLowerCase();
    const row = entryQualitySignalMap.get(key) || {};
    return {
      sampleCount: Number.isFinite(Number(row.sampleCount)) ? Number(row.sampleCount) : 0,
      legacyTemplateHitRate: Number.isFinite(Number(row.legacyTemplateHitRate)) ? Number(row.legacyTemplateHitRate) : legacyTemplateHitRate,
      conciseModeAppliedRate: Number.isFinite(Number(row.conciseModeAppliedRate)) ? Number(row.conciseModeAppliedRate) : conciseRate,
      directAnswerAppliedRate: Number.isFinite(Number(row.directAnswerAppliedRate)) ? Number(row.directAnswerAppliedRate) : directAnswerRate,
      repetitionPreventedRate: Number.isFinite(Number(row.repetitionPreventedRate)) ? Number(row.repetitionPreventedRate) : repetitionPreventedRate,
      clarifySuppressedRate: Number.isFinite(Number(row.clarifySuppressedRate)) ? Number(row.clarifySuppressedRate) : clarifySuppressedRate,
      defaultCasualRate: Number.isFinite(Number(row.defaultCasualRate)) ? Number(row.defaultCasualRate) : defaultCasualRate,
      followupQuestionIncludedRate: Number.isFinite(Number(row.followupQuestionIncludedRate)) ? Number(row.followupQuestionIncludedRate) : followupRate,
      avgContextCarryScore: Number.isFinite(Number(row.avgContextCarryScore)) ? Number(row.avgContextCarryScore) : contextCarryScore,
      avgRepeatRiskScore: Number.isFinite(Number(row.avgRepeatRiskScore)) ? Number(row.avgRepeatRiskScore) : repeatRiskScore
    };
  }
  function resolveEntryAcceptedRate(entryType, fallback) {
    const key = normalizeReason(entryType).toLowerCase();
    if (entryAcceptedRateMap.has(key)) return entryAcceptedRateMap.get(key);
    return fallback;
  }

  const slices = QUALITY_SLICES.map((slice) => {
    const freeBlockedRate = Number.isFinite(Number(byPlan.free && byPlan.free.blockedRate))
      ? Number(byPlan.free.blockedRate)
      : null;
    const paidBlockedRate = Number.isFinite(Number(byPlan.pro && byPlan.pro.blockedRate))
      ? Number(byPlan.pro.blockedRate)
      : null;
    const freeAcceptedRate = freeBlockedRate === null ? acceptedRate : clamp01(1 - freeBlockedRate);
    const paidAcceptedRate = paidBlockedRate === null ? acceptedRate : clamp01(1 - paidBlockedRate);
    const compatShare = clamp01(Number((data.optimization && data.optimization.compatShareWindow) || 0));
    const compatQualityPressure = clamp01(1 - (compatShare * 0.8));
    const webhookSignals = resolveEntrySignals('webhook');
    const adminSignals = resolveEntrySignals('admin');
    const compatSignals = resolveEntrySignals('compat');
    const adminAcceptedRate = resolveEntryAcceptedRate('admin', acceptedRate);
    const compatAcceptedRate = resolveEntryAcceptedRate('compat', compatQualityPressure);
    const webhookAcceptedRate = resolveEntryAcceptedRate('webhook', acceptedRate);
    let score = 0;
    if (slice.sliceKey === 'paid') score = clamp01((paidAcceptedRate + conciseRate + directAnswerRate + contextCarryScore) / 4);
    else if (slice.sliceKey === 'free') {
      const freeQualityBase = clamp01((
        conciseRate
        + directAnswerRate
        + followupRate
        + contextCarryScore
        + (1 - legacyTemplateHitRate)
        + (1 - repeatRiskScore)
        + (1 - defaultCasualRate)
      ) / 7);
      const freeFlowAllowance = clamp01(Math.max(freeAcceptedRate, Math.min(1, webhookAcceptedRate + 0.15)));
      score = clamp01((freeQualityBase * 0.75) + (freeFlowAllowance * 0.25));
    } else if (slice.sliceKey === 'admin') {
      score = clamp01((
        (adminAcceptedRate * 0.4)
        + (adminSignals.conciseModeAppliedRate * 0.2)
        + (adminSignals.directAnswerAppliedRate * 0.2)
        + ((1 - adminSignals.legacyTemplateHitRate) * 0.1)
        + ((1 - adminSignals.avgRepeatRiskScore) * 0.1)
      ));
    } else if (slice.sliceKey === 'compat') {
      score = clamp01((
        (compatAcceptedRate * 0.3)
        + (compatQualityPressure * 0.3)
        + (compatSignals.conciseModeAppliedRate * 0.15)
        + (compatSignals.directAnswerAppliedRate * 0.15)
        + ((1 - compatSignals.legacyTemplateHitRate) * 0.1)
      ));
    }
    else if (slice.sliceKey === 'short_followup') score = clamp01((1 - defaultCasualRate + followupRate) / 2);
    else if (slice.sliceKey === 'domain_continuation') score = clamp01(domainConciergeRate);
    else if (slice.sliceKey === 'group_chat') score = clamp01(1 - directUrlRate);
    else if (slice.sliceKey === 'japanese_service_quality') score = clamp01((conciseRate + (1 - legacyTemplateHitRate)) / 2);
    else if (slice.sliceKey === 'minority_personas') score = clamp01((unsupportedClaims + followupRate) / 2);
    else if (slice.sliceKey === 'cultural_slices') score = clamp01((followupRate + domainConciergeRate) / 2);
    const status = score >= 0.75 ? 'pass' : (score >= 0.6 ? 'warning' : 'fail');
    return {
      sliceKey: slice.sliceKey,
      critical: slice.critical,
      score,
      status,
      sampleCount: (
        slice.sliceKey === 'admin' ? Number(adminSignals.sampleCount || 0)
          : slice.sliceKey === 'compat' ? Number(compatSignals.sampleCount || 0)
            : slice.sliceKey === 'free' ? Number(webhookSignals.sampleCount || 0)
              : Number(conversation.sampleCount || 0)
      )
    };
  });

  const weighted = dimensions.reduce((sum, row) => sum + (row.score * row.weight), 0);
  const overallScore = Math.round(weighted * 10000) / 100;

  const hardFailures = [];
  dimensions.forEach((row) => {
    if (row.hardGate === true && row.status === 'fail') hardFailures.push(`dimension_fail:${row.key}`);
  });
  slices.forEach((row) => {
    if (row.status === 'fail') hardFailures.push(`slice_fail:${row.sliceKey}`);
    if (row.critical === true && row.status !== 'pass') hardFailures.push(`critical_slice_regression:${row.sliceKey}`);
  });
  if (Number(releaseReadiness.ready) !== 1 && releaseReadiness.ready !== true) hardFailures.push('release_readiness_blocked');

  const judgeConfidence = averageFromRows(actionRows, (row) => row && row.judgeConfidence);
  const judgeDisagreement = averageFromRows(actionRows, (row) => row && row.judgeDisagreement);
  const multilingualStability = clamp01(1 - (judgeDisagreement / 2));
  const promptSensitivityDrift = clamp01(judgeDisagreement);
  const humanReviewRequired = judgeDisagreement > 0.15 || promptSensitivityDrift > 0.1;
  if (humanReviewRequired) hardFailures.push('judge_human_review_required');

  const benchmarkVersionMap = new Map();
  actionRows.forEach((row) => {
    const key = normalizeReason(row && row.benchmarkVersion);
    if (key === 'none') return;
    benchmarkVersionMap.set(key, (benchmarkVersionMap.get(key) || 0) + 1);
  });
  const benchmarkVersionRows = Array.from(benchmarkVersionMap.entries()).sort((a, b) => b[1] - a[1]);
  const benchmarkVersion = benchmarkVersionRows.length > 0 ? benchmarkVersionRows[0][0] : 'bench-v1.0.0';
  const contaminationRisk = pickMaxContaminationRisk(actionRows);
  if (contaminationRisk === 'high') hardFailures.push('contamination_risk_high');

  const replayFailureRows = actionRows.filter((row) => normalizeReason(row && row.replayFailureType) !== 'none');
  const replayCriticalFailures = replayFailureRows.filter((row) => {
    const type = normalizeReason(row && row.replayFailureType);
    return ['stale_source', 'contradictory_source', 'evidence_swap'].includes(type);
  }).length;
  const replayWarningFailures = Math.max(0, replayFailureRows.length - replayCriticalFailures);
  if (replayCriticalFailures > 0) hardFailures.push('replay_critical_failures');

  const latencyValues = actionRows.map((row) => Number(row && row.latencyMs)).filter((value) => Number.isFinite(value) && value >= 0);
  const costValues = actionRows.map((row) => Number(row && row.costUsd)).filter((value) => Number.isFinite(value) && value >= 0);
  const latencyP50Ms = percentile(latencyValues, 50);
  const latencyP95Ms = percentile(latencyValues, 95);
  const costPerTurnUsd = costValues.length > 0
    ? Math.round((costValues.reduce((sum, value) => sum + value, 0) / costValues.length) * 1000000) / 1000000
    : 0;
  const ackSlaViolationRate = clamp01(averageFromRows(actionRows, (row) => row && row.latencyMs > 2000 ? 1 : 0));
  const qualityDelta = Math.round((overallScore - baselineOverall) * 10000) / 10000;
  const latencyRegressionRate = baselineOverall > 0 ? Math.max(0, (latencyP95Ms - 1840) / 1840) : 0;
  const costRegressionRate = Math.max(0, (costPerTurnUsd - 0.031) / 0.031);
  const frontierWarnings = [];
  const frontierFailures = [];
  if (qualityDelta < QUALITY_FRONTIER_THRESHOLDS.qualityDeltaWarningBelow && latencyRegressionRate > QUALITY_FRONTIER_THRESHOLDS.latencyRegressionWarnRate) {
    frontierWarnings.push('quality_delta_small_with_latency_regression');
  }
  if (qualityDelta <= 0 && costRegressionRate > QUALITY_FRONTIER_THRESHOLDS.costRegressionBlockRate) {
    frontierFailures.push('quality_non_improving_with_cost_regression');
  }
  if (ackSlaViolationRate > QUALITY_FRONTIER_THRESHOLDS.ackSlaViolationBlockRate) {
    frontierFailures.push('ack_sla_violation_rate_exceeded');
  }
  frontierFailures.forEach((item) => hardFailures.push(`frontier:${item}`));

  const qualityLoopV2 = buildQualityLoopV2Summary({
    actionRows,
    traceSearchAuditRows: Array.isArray(data.traceSearchAuditRows) ? data.traceSearchAuditRows : [],
    conversationQuality: conversation,
    optimization: data.optimization
  });
  const runtimeAuditPayload = data.runtimeAudit && typeof data.runtimeAudit === 'object' ? data.runtimeAudit : null;
  const inferredRuntimeAuditUnavailable = runtimeAuditPayload
    ? runtimeAuditPayload.runtimeAuditUnavailable === true
    : (actionRows.length + (Array.isArray(data.traceSearchAuditRows) ? data.traceSearchAuditRows.length : 0)) <= 0;
  const inferredRuntimeFetchStatus = runtimeAuditPayload && typeof runtimeAuditPayload.runtimeFetchStatus === 'string'
    ? runtimeAuditPayload.runtimeFetchStatus
    : (inferredRuntimeAuditUnavailable ? 'unavailable' : 'ok');
  qualityLoopV2.runtimeAudit = {
    status: inferredRuntimeAuditUnavailable ? 'action_required' : 'ok',
    runtimeAuditUnavailable: inferredRuntimeAuditUnavailable,
    runtimeFetchStatus: inferredRuntimeFetchStatus,
    runtimeFetchErrorCode: runtimeAuditPayload && runtimeAuditPayload.runtimeFetchErrorCode
      ? runtimeAuditPayload.runtimeFetchErrorCode
      : (inferredRuntimeAuditUnavailable ? 'runtime_audit_unavailable' : null),
    runtimeFetchErrorMessage: runtimeAuditPayload && runtimeAuditPayload.runtimeFetchErrorMessage
      ? runtimeAuditPayload.runtimeFetchErrorMessage
      : (inferredRuntimeAuditUnavailable ? 'Live runtime audit is unavailable.' : null),
    recoveryActionCode: runtimeAuditPayload && runtimeAuditPayload.recoveryActionCode
      ? runtimeAuditPayload.recoveryActionCode
      : null,
    recoveryCommands: runtimeAuditPayload && Array.isArray(runtimeAuditPayload.recoveryCommands)
      ? runtimeAuditPayload.recoveryCommands.slice(0, 5)
      : []
  };
  qualityLoopV2.criticalSlices.forEach((row) => {
    if (!row || row.status === 'pass') return;
    hardFailures.push(`quality_loop_v2_critical_slice_fail:${row.sliceKey}`);
  });
  const boards = buildTopQualityBoards(actionRows, hardFailures);
  const counterexampleQueue = buildCounterexampleQueueFromBoards(boards);
  qualityLoopV2.improvementLoop = buildImprovementLoopSummary({
    qualityLoopV2,
    actionRows,
    traceSearchAuditRows: Array.isArray(data.traceSearchAuditRows) ? data.traceSearchAuditRows : [],
    hardFailures,
    topQualityFailures: boards.topQualityFailures,
    topLoopCases: boards.topLoopCases,
    topContextLossCases: boards.topContextLossCases
  });

  return {
    frameworkVersion: 'v1',
    generatedAt: new Date().toISOString(),
    overallScore,
    baselineScore: baselineOverall,
    qualityDelta,
    categoryImprovementRate,
    categoryRegressionRate,
    improvedDimensions,
    regressedDimensions,
    unmetCategories,
    warningCategoryCount: warningDimensions.length,
    failCategoryCount: failDimensions.length,
    dimensions,
    slices,
    hardGate: {
      pass: hardFailures.length === 0,
      failures: Array.from(new Set(hardFailures)),
      warnings: Array.from(new Set(frontierWarnings))
    },
    top_10_quality_failures: boards.topQualityFailures,
    top_10_loop_cases: boards.topLoopCases,
    top_10_context_loss_cases: boards.topContextLossCases,
    top_10_japanese_service_failures: boards.topJapaneseServiceFailures,
    top_10_line_fit_failures: boards.topLineFitFailures,
    topQualityFailures: boards.topQualityFailures,
    topLoopCases: boards.topLoopCases,
    topContextLossCases: boards.topContextLossCases,
    topJapaneseServiceFailures: boards.topJapaneseServiceFailures,
    topLineFitFailures: boards.topLineFitFailures,
    counterexampleQueue,
    counterexampleQueueOpenCount: counterexampleQueue.length,
    judgeCalibration: {
      confidence: judgeConfidence,
      disagreementRate: judgeDisagreement,
      multilingualStability,
      promptSensitivityDrift,
      humanReviewRequired
    },
    benchmark: {
      version: benchmarkVersion,
      frozen: true,
      contaminationRisk
    },
    contractFreeze: CONTRACT_FREEZE_SUMMARY,
    replay: {
      totalCases: Number(conversation.sampleCount || 0),
      criticalFailures: replayCriticalFailures,
      warningFailures: replayWarningFailures
    },
    frontier: {
      qualityScore: overallScore,
      latencyP50Ms: Math.round(latencyP50Ms),
      latencyP95Ms: Math.round(latencyP95Ms),
      costPerTurnUsd,
      ackSlaViolationRate,
      latencyRegressionRate: Math.round(latencyRegressionRate * 10000) / 10000,
      costRegressionRate: Math.round(costRegressionRate * 10000) / 10000,
      status: frontierFailures.length > 0 ? 'fail' : (frontierWarnings.length > 0 ? 'warning' : 'pass')
    },
    qualityLoopV2
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
    let traceSearchAuditRows = [];
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
    try {
      const rawTraceAuditRows = await auditLogsRepo.listAuditLogs({
        action: 'trace_search.view',
        limit: scanLimit
      });
      const fromMs = fromAt.getTime();
      const toMs = toAt.getTime();
      traceSearchAuditRows = buildTraceSearchAuditRows((Array.isArray(rawTraceAuditRows) ? rawTraceAuditRows : []).filter((row) => {
        const ms = toMillis(row && row.createdAt);
        return Number.isFinite(ms) && ms >= fromMs && ms <= toMs;
      }));
    } catch (_err) {
      traceSearchAuditRows = [];
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
    const qualityFrameworkSummary = buildQualityFrameworkSummary({
      conversationQuality: conversationQualitySummary,
      gateAuditBaseline: gateAuditBaselineSummary,
      optimization: optimizationSummary,
      releaseReadiness,
      byPlan: buildPlanBreakdown(rows),
      actionRows,
      traceSearchAuditRows,
      baselineOverallScore: Number(process.env.LLM_QUALITY_BASELINE_SCORE || 54.9)
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
      releaseReadiness,
      qualityFramework: qualityFrameworkSummary
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
      qualityOverallScore: qualityFrameworkSummary.overallScore,
      qualityHardGatePass: qualityFrameworkSummary.hardGate && qualityFrameworkSummary.hardGate.pass === true,
      qualityLoopV2Version: qualityFrameworkSummary.qualityLoopV2 && qualityFrameworkSummary.qualityLoopV2.version
        ? qualityFrameworkSummary.qualityLoopV2.version
        : 'none',
      qualityLoopV2CriticalSliceFailCount: qualityFrameworkSummary.qualityLoopV2 && Array.isArray(qualityFrameworkSummary.qualityLoopV2.criticalSlices)
        ? qualityFrameworkSummary.qualityLoopV2.criticalSlices.filter((row) => row && row.status === 'fail').length
        : 0,
      qualityLoopV2MissingJoinCount: qualityFrameworkSummary.qualityLoopV2 && Array.isArray(qualityFrameworkSummary.qualityLoopV2.missingJoins)
        ? qualityFrameworkSummary.qualityLoopV2.missingJoins.length
        : 0,
      contractRegistryVersion: qualityFrameworkSummary.contractFreeze && qualityFrameworkSummary.contractFreeze.registryVersion
        ? qualityFrameworkSummary.contractFreeze.registryVersion
        : 'unknown',
        contractRegistryHash: qualityFrameworkSummary.contractFreeze && qualityFrameworkSummary.contractFreeze.registryHash
          ? qualityFrameworkSummary.contractFreeze.registryHash
          : 'unknown',
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
  buildQualityFrameworkSummary,
  buildQualityLoopV2Summary,
  buildImprovementLoopSummary,
  buildTraceSearchAuditRows,
  buildContractFreezeSummary,
  buildCounterexampleQueueFromBoards,
  maskLineUserId
};
