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

  const missing = [];
  if (!hasMemberNumber && !memberNumberStale) {
    missing.push('missing_member_number');
  }
  if (memberNumberStale) {
    missing.push('stale_member_number');
  }
  // TODO(phase24-t03): checklist_incomplete when summary provides checklist status

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
