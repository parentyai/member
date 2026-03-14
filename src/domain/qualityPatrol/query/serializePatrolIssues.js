'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');

const SEVERITY_RANK = Object.freeze({ critical: 0, high: 1, medium: 2, low: 3 });
const STATUS_RANK = Object.freeze({ blocked: 0, open: 1, watching: 2, resolved: 3, unavailable: 4 });

function issueMatchKey(issue) {
  return [
    issue && issue.layer ? String(issue.layer).trim().toLowerCase() : '',
    issue && issue.category ? String(issue.category).trim().toLowerCase() : '',
    issue && issue.slice ? String(issue.slice).trim().toLowerCase() : ''
  ].join('|');
}

function buildExistingIssueSet(rows) {
  return new Set((Array.isArray(rows) ? rows : []).map((row) => issueMatchKey(row)));
}

function sortIssues(mode, blockersPresent, rows) {
  const ranked = (Array.isArray(rows) ? rows : []).slice();
  ranked.sort((left, right) => {
    if (mode === 'newly-detected-improvements' && left.changeStatus !== right.changeStatus) {
      return left.changeStatus === 'new' ? -1 : 1;
    }
    if (blockersPresent && left.status !== right.status) {
      const leftStatusRank = Object.prototype.hasOwnProperty.call(STATUS_RANK, left.status) ? STATUS_RANK[left.status] : 9;
      const rightStatusRank = Object.prototype.hasOwnProperty.call(STATUS_RANK, right.status) ? STATUS_RANK[right.status] : 9;
      return leftStatusRank - rightStatusRank;
    }
    const leftSeverityRank = Object.prototype.hasOwnProperty.call(SEVERITY_RANK, left.severity) ? SEVERITY_RANK[left.severity] : 9;
    const rightSeverityRank = Object.prototype.hasOwnProperty.call(SEVERITY_RANK, right.severity) ? SEVERITY_RANK[right.severity] : 9;
    const severityDiff = leftSeverityRank - rightSeverityRank;
    if (severityDiff !== 0) return severityDiff;
    return left.title.localeCompare(right.title, 'ja');
  });
  return ranked;
}

function serializePatrolIssues(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const mode = typeof payload.mode === 'string' ? payload.mode : 'latest';
  const blockersPresent = Array.isArray(payload.observationBlockers) && payload.observationBlockers.length > 0;
  const existingIssueSet = buildExistingIssueSet(payload.existingIssues);
  const limit = Number.isFinite(Number(payload.limit)) ? Math.max(1, Math.min(20, Math.floor(Number(payload.limit)))) : 8;
  const currentIssues = Array.isArray(payload.issues) ? payload.issues : [];

  let rows = currentIssues.map((issue) => {
    const isNew = !existingIssueSet.has(issueMatchKey(issue));
    const summary = audience === 'human'
      ? (issue && issue.summary ? String(issue.summary) : `${issue && issue.title ? issue.title : 'Quality finding'} が見つかりました。`)
      : (issue && issue.summary ? String(issue.summary) : `${issue && issue.title ? issue.title : 'Quality finding'} (${issue && issue.slice ? issue.slice : 'global'})`);
    return {
      issueKey: issue && issue.issueKey ? issue.issueKey : '',
      title: issue && issue.title ? issue.title : 'Quality finding',
      severity: issue && issue.severity ? issue.severity : 'medium',
      status: issue && issue.status ? issue.status : 'watching',
      category: issue && issue.category ? issue.category : 'unknown',
      summary,
      provenance: issue && issue.provenance ? issue.provenance : 'quality_patrol_detection',
      evidenceCount: Array.isArray(issue && issue.supportingEvidence) ? issue.supportingEvidence.length : 0,
      changeStatus: isNew ? 'new' : 'ongoing',
      slice: issue && issue.slice ? issue.slice : 'global'
    };
  });

  if (mode === 'observation-blockers') {
    rows = rows.filter((item) => item.status === 'blocked');
  }

  if (mode === 'top-risk') {
    rows = rows.filter((item) => ['critical', 'high', 'medium'].includes(item.severity));
  }

  return sortIssues(mode, blockersPresent, rows).slice(0, limit);
}

module.exports = {
  serializePatrolIssues
};
