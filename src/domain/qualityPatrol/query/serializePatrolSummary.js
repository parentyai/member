'use strict';

const { buildHumanReadableFindings } = require('./buildHumanReadableFindings');

function mapOverallStatus(params) {
  const payload = params && typeof params === 'object' ? params : {};
  if (payload.hasEvidence !== true) return 'insufficient_evidence';
  if (payload.observationBlockerCount > 0 || payload.planningStatus === 'blocked') return 'blocked';
  if (payload.planningStatus === 'insufficient_evidence') return 'insufficient_evidence';
  if (payload.kpiStatus === 'unavailable') return 'unavailable';
  if (payload.kpiStatus === 'fail' || payload.hasSevereIssue === true) return 'fail';
  if (payload.kpiStatus === 'warn' || payload.issueCount > 0 || payload.recommendedPrCount > 0) return 'warning';
  return 'ok';
}

function serializePatrolSummary(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const topFindings = buildHumanReadableFindings(payload);
  return {
    overallStatus: mapOverallStatus(payload),
    topFindings,
    topPriorityCount: Number(payload.topPriorityCount || 0),
    observationBlockerCount: Number(payload.observationBlockerCount || 0)
  };
}

module.exports = {
  serializePatrolSummary
};
