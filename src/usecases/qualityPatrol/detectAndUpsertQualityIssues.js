'use strict';

const { buildPatrolKpisFromEvaluations } = require('./buildPatrolKpisFromEvaluations');
const { detectIssues } = require('../../domain/qualityPatrol/detectIssues');
const { upsertQualityIssue } = require('./upsertQualityIssue');
const { upsertImprovementBacklog } = require('./upsertImprovementBacklog');

function confidenceToNumber(value) {
  if (value === 'high') return 0.85;
  if (value === 'medium') return 0.65;
  return 0.35;
}

function backlogPriorityToRegistry(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  return ['p0', 'p1', 'p2', 'p3'].includes(normalized) ? normalized : 'p2';
}

function registryStatusFromDetection(value) {
  if (value === 'blocked') return 'watching';
  if (value === 'watching') return 'watching';
  if (value === 'resolved') return 'mitigated';
  return 'open';
}

function registrySliceFromDetection(value) {
  if (value === 'global') return 'other';
  return value;
}

function registryIssueInput(candidate, payload) {
  const scopeHint = candidate && candidate.fingerprintInput && candidate.fingerprintInput.scope
    ? `scope_${candidate.fingerprintInput.scope}`
    : 'scope_unknown';
  return {
    threadId: payload.threadId || 'quality_patrol_detection',
    layer: candidate.layer || (candidate.issueType === 'observation_blocker' ? 'observation' : 'conversation'),
    category: candidate.category || candidate.metricKey,
    slice: registrySliceFromDetection(candidate.slice),
    severity: candidate.severity,
    status: registryStatusFromDetection(candidate.status),
    provenance: 'prepared_summary',
    observationBlocker: candidate.issueType === 'observation_blocker' || candidate.status === 'blocked',
    confidence: confidenceToNumber(candidate.confidence),
    supportingEvidence: candidate.supportingEvidence,
    traceRefs: payload.traceRefs || [],
    sourceCollections: candidate.sourceCollections,
    latestSummary: candidate.summary,
    rootCauseHint: [scopeHint, candidate.metricKey, candidate.issueType],
    relatedMetrics: [{
      metric: candidate.metricKey,
      value: candidate.supportingEvidence && candidate.supportingEvidence[0] ? candidate.supportingEvidence[0].value : null,
      sampleCount: candidate.supportingEvidence && candidate.supportingEvidence[0] ? candidate.supportingEvidence[0].sampleCount : null,
      status: candidate.metricStatus
    }]
  };
}

function buildBacklogPayload(backlogCandidate, issueIds, candidate) {
  return {
    issueIds,
    status: 'proposed',
    priority: backlogPriorityToRegistry(backlogCandidate.priority),
    proposedPrName: backlogCandidate.title.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'PR-Quality-Patrol-Improvement',
    objective: backlogCandidate.objective,
    whyNow: candidate.summary,
    expectedKpiMovement: [{
      metric: candidate.metricKey,
      status: candidate.metricStatus
    }],
    provenance: 'prepared_summary'
  };
}

async function detectAndUpsertQualityIssues(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const persist = payload.persist === true;
  const persistBacklog = payload.persistBacklog === true || (persist && payload.persistBacklog !== false);
  const kpiBuilder = deps && deps.buildPatrolKpisFromEvaluations
    ? deps.buildPatrolKpisFromEvaluations
    : buildPatrolKpisFromEvaluations;
  const detector = deps && deps.detectIssues ? deps.detectIssues : detectIssues;
  const issueUpsert = deps && deps.upsertQualityIssue ? deps.upsertQualityIssue : upsertQualityIssue;
  const backlogUpsert = deps && deps.upsertImprovementBacklog ? deps.upsertImprovementBacklog : upsertImprovementBacklog;

  const kpiResult = payload.kpiResult
    ? payload.kpiResult
    : await kpiBuilder(payload, deps);
  const detection = detector({
    kpiResult,
    threadId: payload.threadId,
    traceRefs: payload.traceRefs
  });

  if (!persist) {
    return Object.assign({ ok: true, persisted: false, backlogPersisted: false }, detection, {
      kpiResult
    });
  }

  const upsertedIssues = [];
  for (const candidate of detection.issueCandidates) {
    const result = await issueUpsert(registryIssueInput(candidate, payload), deps);
    upsertedIssues.push({
      issueKey: candidate.issueKey,
      issueId: result && result.issue ? result.issue.issueId : null,
      created: result && result.created === true
    });
  }

  const issueIdByKey = new Map(upsertedIssues.map((item) => [item.issueKey, item.issueId]).filter((entry) => entry[1]));
  const upsertedBacklogs = [];
  if (persistBacklog) {
    for (const backlogCandidate of detection.backlogCandidates) {
      const relatedIssueIds = backlogCandidate.issueKeys.map((key) => issueIdByKey.get(key)).filter(Boolean);
      if (!relatedIssueIds.length) continue;
      const anchorIssue = detection.issueCandidates.find((item) => backlogCandidate.issueKeys.includes(item.issueKey));
      const result = await backlogUpsert(buildBacklogPayload(backlogCandidate, relatedIssueIds, anchorIssue), deps);
      upsertedBacklogs.push({
        backlogKey: backlogCandidate.backlogKey,
        backlogId: result && result.backlog ? result.backlog.backlogId : null,
        created: result && result.created === true
      });
    }
  }

  return Object.assign({
    ok: true,
    persisted: true,
    backlogPersisted: persistBacklog,
    upsertedIssues,
    upsertedBacklogs
  }, detection, {
    kpiResult
  });
}

module.exports = {
  detectAndUpsertQualityIssues
};
