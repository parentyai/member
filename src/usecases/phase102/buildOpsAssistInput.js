'use strict';

const crypto = require('crypto');

const PROMPT_VERSION = 'phase102_v1';

function normalizeReadiness(value) {
  if (!value || typeof value !== 'object') {
    return { status: null, blocking: [] };
  }
  return {
    status: typeof value.status === 'string' ? value.status : null,
    blocking: Array.isArray(value.blocking) ? value.blocking.slice() : []
  };
}

function normalizeOpsState(value) {
  if (!value || typeof value !== 'object') {
    return {
      nextAction: null,
      failure_class: null,
      reasonCode: null,
      stage: null,
      note: null,
      updatedAt: null
    };
  }
  return {
    nextAction: typeof value.nextAction === 'string' ? value.nextAction : null,
    failure_class: typeof value.failure_class === 'string' ? value.failure_class : null,
    reasonCode: typeof value.reasonCode === 'string' ? value.reasonCode : null,
    stage: typeof value.stage === 'string' ? value.stage : null,
    note: typeof value.note === 'string' ? value.note : null,
    updatedAt: value.updatedAt || null
  };
}

function normalizeLatestDecisionLog(value) {
  if (!value || typeof value !== 'object') {
    return {
      nextAction: null,
      createdAt: null,
      auditSnapshot: null
    };
  }
  return {
    nextAction: typeof value.nextAction === 'string' ? value.nextAction : null,
    createdAt: value.createdAt || null,
    auditSnapshot: value.audit || null
  };
}

function resolveChecklistCompleteness(summary) {
  if (!summary || typeof summary !== 'object') return null;
  if (summary.checklist && typeof summary.checklist === 'object') {
    return summary.checklist.completeness || null;
  }
  if (summary.checklistCompleteness) return summary.checklistCompleteness;
  return null;
}

function normalizeUserStateSummary(value) {
  if (!value || typeof value !== 'object') {
    return {
      registrationCompleteness: null,
      checklistCompleteness: null,
      opsStateCompleteness: null,
      opsDecisionCompleteness: null,
      overallDecisionReadiness: null,
      userSummaryCompleteness: null
    };
  }
  return {
    registrationCompleteness: value.registrationCompleteness || null,
    checklistCompleteness: resolveChecklistCompleteness(value),
    opsStateCompleteness: value.opsStateCompleteness || null,
    opsDecisionCompleteness: value.opsDecisionCompleteness || null,
    overallDecisionReadiness: value.overallDecisionReadiness || null,
    userSummaryCompleteness: value.userSummaryCompleteness || null
  };
}

function normalizeMemberSummary(value) {
  if (!value || typeof value !== 'object') {
    return {
      memberNumberStatus: null,
      registrationCompleteness: null,
      opsStateCompleteness: null,
      opsDecisionCompleteness: null,
      overallDecisionReadiness: null
    };
  }
  const member = value.member || {};
  const hasMemberNumber = typeof member.hasMemberNumber === 'boolean' ? member.hasMemberNumber : null;
  const memberNumberStale = typeof member.memberNumberStale === 'boolean' ? member.memberNumberStale : null;
  const memberNumberStatus = (hasMemberNumber === null && memberNumberStale === null)
    ? null
    : { hasMemberNumber, memberNumberStale };
  return {
    memberNumberStatus,
    registrationCompleteness: value.registrationCompleteness || null,
    opsStateCompleteness: value.opsStateCompleteness || null,
    opsDecisionCompleteness: value.opsDecisionCompleteness || null,
    overallDecisionReadiness: value.overallDecisionReadiness || null
  };
}

function normalizeConstraints(view, readiness) {
  const allowedNextActions = Array.isArray(view.allowedNextActions)
    ? view.allowedNextActions.filter((item) => typeof item === 'string')
    : [];
  return {
    allowedNextActions,
    readiness: readiness && typeof readiness.status === 'string' ? readiness.status : null
  };
}

function buildOpsAssistInput(params) {
  const payload = params || {};
  const view = payload.opsConsoleView || {};
  const readiness = normalizeReadiness(view.readiness);
  const opsState = normalizeOpsState(view.opsState);
  const latestDecisionLog = normalizeLatestDecisionLog(view.latestDecisionLog);
  const userStateSummary = normalizeUserStateSummary(view.userStateSummary);
  const memberSummary = normalizeMemberSummary(view.memberSummary);
  const constraints = normalizeConstraints(view, readiness);

  return {
    promptVersion: PROMPT_VERSION,
    readiness,
    opsState,
    latestDecisionLog,
    userStateSummary,
    memberSummary,
    constraints
  };
}

function computeOpsAssistInputHash(input) {
  if (!input) return null;
  const text = JSON.stringify(input);
  return crypto.createHash('sha256').update(text).digest('hex');
}

module.exports = {
  PROMPT_VERSION,
  buildOpsAssistInput,
  computeOpsAssistInputHash
};
