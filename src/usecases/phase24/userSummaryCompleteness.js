'use strict';

const SEVERITY_ORDER = {
  INFO: 0,
  WARN: 1,
  BLOCK: 2
};

const MISSING_SEVERITY = {
  missing_member_number: 'BLOCK',
  stale_member_number: 'WARN',
  checklist_incomplete: 'WARN'
};

function maxSeverity(current, next) {
  if (SEVERITY_ORDER[next] > SEVERITY_ORDER[current]) return next;
  return current;
}

function evaluateUserSummaryCompleteness(summary) {
  const member = summary && summary.member ? summary.member : {};
  const hasMemberNumber = Boolean(member.hasMemberNumber);
  const memberNumberStale = Boolean(member.memberNumberStale);
  const checklist = summary && summary.checklist ? summary.checklist : null;
  const checklistCompletion = checklist && checklist.completion ? checklist.completion : null;
  const checklistCompleteness = checklist && checklist.completeness ? checklist.completeness : (summary && summary.checklistCompleteness ? summary.checklistCompleteness : null);

  const missing = [];
  if (!hasMemberNumber && !memberNumberStale) {
    missing.push('missing_member_number');
  }
  if (memberNumberStale) {
    missing.push('stale_member_number');
  }
  if (checklistCompletion && checklistCompletion.isComplete === false) {
    missing.push('checklist_incomplete');
  } else if (checklistCompleteness && checklistCompleteness.ok === false) {
    missing.push('checklist_incomplete');
  }

  let severity = 'INFO';
  let hasBlock = false;
  missing.forEach((code) => {
    const next = MISSING_SEVERITY[code] || 'WARN';
    severity = maxSeverity(severity, next);
    if (next === 'BLOCK') hasBlock = true;
  });

  const ok = !hasBlock;
  const needsAttention = missing.length > 0;

  return {
    ok,
    missing,
    needsAttention,
    severity
  };
}

module.exports = {
  evaluateUserSummaryCompleteness
};
