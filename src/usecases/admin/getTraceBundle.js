'use strict';

const auditLogsRepo = require('../../repos/firestore/auditLogsRepo');
const decisionLogsRepo = require('../../repos/firestore/decisionLogsRepo');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const llmActionLogsRepo = require('../../repos/firestore/llmActionLogsRepo');
const sourceEvidenceRepo = require('../../repos/firestore/sourceEvidenceRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const emergencyEventsRepo = require('../../repos/firestore/emergencyEventsRepo');
const emergencyBulletinsRepo = require('../../repos/firestore/emergencyBulletinsRepo');
const cityPackBulletinsRepo = require('../../repos/firestore/cityPackBulletinsRepo');
const taskEventsRepo = require('../../repos/firestore/taskEventsRepo');
const journeyBranchQueueRepo = require('../../repos/firestore/journeyBranchQueueRepo');

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim().length === 0) throw new Error(`${label} required`);
  return value.trim();
}

function resolveLimit(value) {
  if (value === undefined || value === null) return 50;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 50;
  return Math.min(Math.floor(num), 200);
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function hasAuditPrefix(audits, prefix) {
  const normalizedPrefix = normalizeText(prefix).toLowerCase();
  return (Array.isArray(audits) ? audits : []).some((row) => normalizeText(row && row.action).toLowerCase().startsWith(normalizedPrefix));
}

function hasAnyLlmSignal(rows, predicate) {
  return (Array.isArray(rows) ? rows : []).some((row) => {
    try {
      return predicate(row || {});
    } catch (_err) {
      return false;
    }
  });
}

function buildTraceJoinSummary(payload) {
  const data = payload && typeof payload === 'object' ? payload : {};
  const audits = Array.isArray(data.audits) ? data.audits : [];
  const decisions = Array.isArray(data.decisions) ? data.decisions : [];
  const timeline = Array.isArray(data.timeline) ? data.timeline : [];
  const llmActions = Array.isArray(data.llmActions) ? data.llmActions : [];
  const sourceEvidence = Array.isArray(data.sourceEvidence) ? data.sourceEvidence : [];
  const faqAnswerLogs = Array.isArray(data.faqAnswerLogs) ? data.faqAnswerLogs : [];
  const emergencyEvents = Array.isArray(data.emergencyEvents) ? data.emergencyEvents : [];
  const emergencyBulletins = Array.isArray(data.emergencyBulletins) ? data.emergencyBulletins : [];
  const cityPackBulletins = Array.isArray(data.cityPackBulletins) ? data.cityPackBulletins : [];
  const taskEvents = Array.isArray(data.taskEvents) ? data.taskEvents : [];
  const journeyBranchQueue = Array.isArray(data.journeyBranchQueue) ? data.journeyBranchQueue : [];

  const expectedDomains = [];
  const joinedDomains = [];
  function expect(domainKey, condition, joinedCondition) {
    if (!condition) return;
    expectedDomains.push(domainKey);
    if (joinedCondition) joinedDomains.push(domainKey);
  }

  expect('audits', audits.length > 0 || decisions.length > 0 || timeline.length > 0 || llmActions.length > 0, audits.length > 0);
  expect('decisions', decisions.length > 0, decisions.length > 0);
  expect('timeline', timeline.length > 0 || decisions.length > 0, timeline.length > 0);
  expect('llmActions', llmActions.length > 0 || hasAuditPrefix(audits, 'llm_'), llmActions.length > 0);
  expect(
    'sourceEvidence',
    sourceEvidence.length > 0 || hasAnyLlmSignal(llmActions, (row) =>
      (Array.isArray(row.sourceSnapshotRefs) && row.sourceSnapshotRefs.length > 0)
      || Number(row.sourceAuthorityScore) > 0
      || Number(row.sourceFreshnessScore) > 0
      || row.cityPackGrounded === true
    ),
    sourceEvidence.length > 0
  );
  expect(
    'faq',
    faqAnswerLogs.length > 0 || hasAuditPrefix(audits, 'faq_') || hasAnyLlmSignal(llmActions, (row) => row.savedFaqReused === true),
    faqAnswerLogs.length > 0
  );
  expect(
    'emergency',
    emergencyEvents.length > 0
      || emergencyBulletins.length > 0
      || hasAuditPrefix(audits, 'emergency.')
      || hasAnyLlmSignal(llmActions, (row) => row.emergencyContextActive === true),
    emergencyEvents.length > 0 || emergencyBulletins.length > 0
  );
  expect(
    'cityPack',
    cityPackBulletins.length > 0
      || hasAuditPrefix(audits, 'city_pack.')
      || hasAnyLlmSignal(llmActions, (row) => row.cityPackGrounded === true || Number(row.cityPackFreshnessScore) > 0),
    cityPackBulletins.length > 0
  );
  expect(
    'journey',
    taskEvents.length > 0
      || journeyBranchQueue.length > 0
      || hasAuditPrefix(audits, 'journey_')
      || hasAuditPrefix(audits, 'task_')
      || hasAnyLlmSignal(llmActions, (row) => row.taskBlockerDetected === true || normalizeText(row.journeyPhase).toLowerCase() !== 'none'),
    taskEvents.length > 0 || journeyBranchQueue.length > 0
  );

  const expectedUnique = Array.from(new Set(expectedDomains));
  const joinedUnique = Array.from(new Set(joinedDomains));
  const missingDomains = expectedUnique.filter((domain) => !joinedUnique.includes(domain));
  const completeness = expectedUnique.length > 0
    ? Math.round((joinedUnique.length / expectedUnique.length) * 10000) / 10000
    : 0;

  return {
    version: 'v2',
    expectedDomains: expectedUnique,
    joinedDomains: joinedUnique,
    missingDomains,
    criticalMissingDomains: missingDomains.filter((domain) => !['decisions', 'timeline'].includes(domain)),
    completeness,
    joinCounts: {
      audits: audits.length,
      decisions: decisions.length,
      timeline: timeline.length,
      llmActions: llmActions.length,
      sourceEvidence: sourceEvidence.length,
      faq: faqAnswerLogs.length,
      emergencyEvents: emergencyEvents.length,
      emergencyBulletins: emergencyBulletins.length,
      cityPackBulletins: cityPackBulletins.length,
      taskEvents: taskEvents.length,
      journeyBranchQueue: journeyBranchQueue.length
    },
    routeHints: {
      entryTypes: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.entryType)).filter(Boolean))),
      routeKinds: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.routeKind)).filter(Boolean))),
      conversationModes: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.conversationMode)).filter(Boolean))),
      routerReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.routerReason)).filter(Boolean))).slice(0, 8),
      strategyReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.strategyReason)).filter(Boolean))).slice(0, 8),
      strategyAlternativeSet: Array.from(new Set(llmActions.flatMap((row) => Array.isArray(row && row.strategyAlternativeSet) ? row.strategyAlternativeSet : []).map((item) => normalizeText(item)).filter(Boolean))).slice(0, 12),
      strategyPriorityVersions: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.strategyPriorityVersion)).filter(Boolean))).slice(0, 8),
      fallbackPriorityReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.fallbackPriorityReason)).filter(Boolean))).slice(0, 8),
      selectedCandidateKinds: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.selectedCandidateKind)).filter(Boolean))).slice(0, 8),
      retrievalBlockReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.retrievalBlockReason)).filter(Boolean))).slice(0, 8),
      retrievalPermitReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.retrievalPermitReason)).filter(Boolean))).slice(0, 8),
      retrievalReenabledBySlices: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.retrievalReenabledBySlice)).filter(Boolean))).slice(0, 8),
      knowledgeRejectedReasons: Array.from(new Set(
        llmActions.flatMap((row) => {
          const list = Array.isArray(row && row.knowledgeRejectedReasons) ? row.knowledgeRejectedReasons : [];
          const single = normalizeText(row && row.knowledgeCandidateRejectedReason);
          return list.concat(single ? [single] : []);
        }).map((item) => normalizeText(item)).filter(Boolean)
      )).slice(0, 8),
      cityPackRejectedReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.cityPackRejectedReason)).filter(Boolean))).slice(0, 8),
      savedFaqRejectedReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.savedFaqRejectedReason)).filter(Boolean))).slice(0, 8),
      knowledgeGroundingKinds: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.knowledgeGroundingKind)).filter(Boolean))).slice(0, 8),
      sourceReadinessDecisionSources: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.sourceReadinessDecisionSource)).filter(Boolean))).slice(0, 8),
      fallbackTypes: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.fallbackType)).filter(Boolean))).slice(0, 8),
      fallbackTemplateKinds: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.fallbackTemplateKind)).filter(Boolean))).slice(0, 8),
      finalizerTemplateKinds: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.finalizerTemplateKind)).filter(Boolean))).slice(0, 8),
      replyTemplateFingerprints: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.replyTemplateFingerprint)).filter(Boolean))).slice(0, 12),
      genericFallbackSlices: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.genericFallbackSlice)).filter(Boolean))).slice(0, 8),
      compatFallbackReasons: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.compatFallbackReason)).filter(Boolean))).slice(0, 8),
      sharedReadinessBridges: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.sharedReadinessBridge)).filter(Boolean))).slice(0, 8),
      routeDecisionSources: Array.from(new Set(llmActions.map((row) => normalizeText(row && row.routeDecisionSource)).filter(Boolean))).slice(0, 8)
    }
  };
}

function listWithFallback(repo, methodName, args) {
  if (!repo || typeof repo[methodName] !== 'function') return Promise.resolve([]);
  try {
    return Promise.resolve(repo[methodName](...args)).catch(() => []);
  } catch (_err) {
    return Promise.resolve([]);
  }
}

async function getTraceBundle(params, deps) {
  const payload = params || {};
  const traceId = requireString(payload.traceId, 'traceId');
  const limit = resolveLimit(payload.limit);

  const auditsRepo = deps && deps.auditLogsRepo ? deps.auditLogsRepo : auditLogsRepo;
  const decisionsRepo = deps && deps.decisionLogsRepo ? deps.decisionLogsRepo : decisionLogsRepo;
  const timelineRepo = deps && deps.decisionTimelineRepo ? deps.decisionTimelineRepo : decisionTimelineRepo;
  const llmActionsTraceRepo = deps && deps.llmActionLogsRepo ? deps.llmActionLogsRepo : llmActionLogsRepo;
  const sourceEvidenceTraceRepo = deps && deps.sourceEvidenceRepo ? deps.sourceEvidenceRepo : sourceEvidenceRepo;
  const faqTraceRepo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  const emergencyEventsTraceRepo = deps && deps.emergencyEventsRepo ? deps.emergencyEventsRepo : emergencyEventsRepo;
  const emergencyBulletinsTraceRepo = deps && deps.emergencyBulletinsRepo ? deps.emergencyBulletinsRepo : emergencyBulletinsRepo;
  const cityPackBulletinsTraceRepo = deps && deps.cityPackBulletinsRepo ? deps.cityPackBulletinsRepo : cityPackBulletinsRepo;
  const taskEventsTraceRepo = deps && deps.taskEventsRepo ? deps.taskEventsRepo : taskEventsRepo;
  const journeyBranchTraceRepo = deps && deps.journeyBranchQueueRepo ? deps.journeyBranchQueueRepo : journeyBranchQueueRepo;

  const [
    audits,
    decisions,
    timeline,
    llmActions,
    sourceEvidence,
    faqAnswerLogs,
    emergencyEvents,
    emergencyBulletins,
    cityPackBulletins,
    taskEvents,
    journeyBranchQueue
  ] = await Promise.all([
    auditsRepo.listAuditLogsByTraceId(traceId, limit),
    decisionsRepo.listDecisionsByTraceId(traceId, limit),
    timelineRepo.listTimelineEntriesByTraceId(traceId, limit),
    listWithFallback(llmActionsTraceRepo, 'listLlmActionLogsByTraceId', [{ traceId, limit }]),
    listWithFallback(sourceEvidenceTraceRepo, 'listEvidenceByTraceId', [traceId, limit]),
    listWithFallback(faqTraceRepo, 'listFaqAnswerLogsByTraceId', [{ traceId, limit }]),
    listWithFallback(emergencyEventsTraceRepo, 'listEventsByTraceId', [traceId, limit]),
    listWithFallback(emergencyBulletinsTraceRepo, 'listBulletinsByTraceId', [traceId, limit]),
    listWithFallback(cityPackBulletinsTraceRepo, 'listBulletinsByTraceId', [traceId, limit]),
    listWithFallback(taskEventsTraceRepo, 'listTaskEventsByTraceId', [{ traceId, limit }]),
    listWithFallback(journeyBranchTraceRepo, 'listJourneyBranchItemsByTraceId', [{ traceId, limit }])
  ]);

  const traceJoinSummary = buildTraceJoinSummary({
    audits,
    decisions,
    timeline,
    llmActions,
    sourceEvidence,
    faqAnswerLogs,
    emergencyEvents,
    emergencyBulletins,
    cityPackBulletins,
    taskEvents,
    journeyBranchQueue
  });

  return {
    ok: true,
    traceId,
    audits,
    decisions,
    timeline,
    joins: {
      llm: {
        audits,
        decisions,
        timeline,
        actions: llmActions
      },
      llmActions,
      sourceRefs: sourceEvidence,
      sourceEvidence,
      faq: faqAnswerLogs,
      faqAnswerLogs,
      emergency: {
        events: emergencyEvents,
        bulletins: emergencyBulletins
      },
      cityPack: {
        bulletins: cityPackBulletins
      },
      journey: {
        taskEvents,
        branchQueue: journeyBranchQueue
      }
    },
    traceJoinSummary
  };
}

module.exports = {
  getTraceBundle,
  buildTraceJoinSummary
};
