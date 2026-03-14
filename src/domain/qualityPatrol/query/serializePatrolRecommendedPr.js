'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');

const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });
const RISK_RANK = Object.freeze({ high: 0, medium: 1, low: 2 });
const OBSERVATION_ONLY_TYPES = new Set([
  'observation_only',
  'sample_collection',
  'transcript_coverage_repair',
  'no_action_until_evidence',
  'blocked_by_observation_gap'
]);

function backlogMatchKey(row) {
  return [
    row && row.title ? String(row.title).trim().toLowerCase() : '',
    row && row.objective ? String(row.objective).trim().toLowerCase() : '',
    row && row.priority ? String(row.priority).trim().toLowerCase() : ''
  ].join('|');
}

function buildExistingBacklogSet(rows) {
  return new Set((Array.isArray(rows) ? rows : []).map((row) => backlogMatchKey({
    title: row && (row.title || row.proposedPrName),
    objective: row && row.objective,
    priority: row && row.priority
  })));
}

function sortRows(mode, blockersPresent, rows) {
  const list = (Array.isArray(rows) ? rows : []).slice();
  list.sort((left, right) => {
    if (mode === 'newly-detected-improvements' && left.changeStatus !== right.changeStatus) {
      return left.changeStatus === 'new' ? -1 : 1;
    }
    if (blockersPresent) {
      const leftObservation = OBSERVATION_ONLY_TYPES.has(left.proposalType);
      const rightObservation = OBSERVATION_ONLY_TYPES.has(right.proposalType);
      if (leftObservation !== rightObservation) return leftObservation ? -1 : 1;
    }
    const leftPriorityRank = Object.prototype.hasOwnProperty.call(PRIORITY_RANK, left.priority) ? PRIORITY_RANK[left.priority] : 9;
    const rightPriorityRank = Object.prototype.hasOwnProperty.call(PRIORITY_RANK, right.priority) ? PRIORITY_RANK[right.priority] : 9;
    const priorityDiff = leftPriorityRank - rightPriorityRank;
    if (priorityDiff !== 0) return priorityDiff;
    const leftRiskRank = Object.prototype.hasOwnProperty.call(RISK_RANK, left.riskLevel) ? RISK_RANK[left.riskLevel] : 9;
    const rightRiskRank = Object.prototype.hasOwnProperty.call(RISK_RANK, right.riskLevel) ? RISK_RANK[right.riskLevel] : 9;
    const riskDiff = leftRiskRank - rightRiskRank;
    if (riskDiff !== 0) return riskDiff;
    return left.title.localeCompare(right.title, 'ja');
  });
  return list;
}

function serializePatrolRecommendedPr(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const mode = typeof payload.mode === 'string' ? payload.mode : 'latest';
  const blockersPresent = Array.isArray(payload.observationBlockers) && payload.observationBlockers.length > 0;
  const existingBacklogSet = buildExistingBacklogSet(payload.existingBacklog);
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(20, Math.floor(Number(payload.limit)))) : (mode === 'newly-detected-improvements' ? 3 : 5);

  let rows = (Array.isArray(payload.recommendedPr) ? payload.recommendedPr : []).map((item) => {
    const isNew = !existingBacklogSet.has(backlogMatchKey(item));
    const row = {
      proposalKey: item && item.proposalKey ? item.proposalKey : '',
      title: item && item.title ? item.title : 'Quality Patrol proposal',
      proposalType: item && item.proposalType ? item.proposalType : 'observation_only',
      priority: item && item.priority ? item.priority : 'P2',
      objective: item && item.objective ? item.objective : 'Improve Quality Patrol coverage or response quality.',
      whyNow: item && item.whyNow ? item.whyNow : '',
      riskLevel: item && item.riskLevel ? item.riskLevel : 'medium',
      blockedBy: Array.isArray(item && item.blockedBy) ? item.blockedBy.slice() : [],
      targetFiles: Array.isArray(item && item.targetFiles) ? item.targetFiles.slice() : [],
      changeStatus: isNew ? 'new' : 'ongoing'
    };
    if (audience === 'operator' && item && item.whyNotOthers) row.whyNotOthers = item.whyNotOthers;
    return row;
  });

  if (mode === 'observation-blockers') {
    rows = rows.filter((item) => OBSERVATION_ONLY_TYPES.has(item.proposalType));
  }

  if (mode === 'next-best-pr') {
    rows = sortRows(mode, blockersPresent, rows).slice(0, Math.min(limit, 3));
    return rows;
  }

  return sortRows(mode, blockersPresent, rows).slice(0, limit);
}

module.exports = {
  serializePatrolRecommendedPr
};
