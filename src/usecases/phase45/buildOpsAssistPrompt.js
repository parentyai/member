'use strict';

const { PROMPT_VERSION } = require('../phase102/buildOpsAssistInput');

const SCHEMA_VERSION = 'phase45.v1';

function normalizeReadiness(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    status: typeof value.status === 'string' ? value.status : null,
    blocking: Array.isArray(value.blocking) ? value.blocking : []
  };
}

function normalizeOpsState(value) {
  if (!value || typeof value !== 'object') return null;
  return {
    nextAction: typeof value.nextAction === 'string' ? value.nextAction : null,
    failure_class: typeof value.failure_class === 'string' ? value.failure_class : null,
    reasonCode: typeof value.reasonCode === 'string' ? value.reasonCode : null,
    stage: typeof value.stage === 'string' ? value.stage : null,
    note: typeof value.note === 'string' ? value.note : null
  };
}

function normalizeAllowedNextActions(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function buildOpsAssistPrompt(params) {
  const payload = params || {};
  const input = payload.opsAssistInput || null;
  const view = payload.opsConsoleView || {};
  const readiness = input ? normalizeReadiness(input.readiness) : normalizeReadiness(view.readiness);
  const opsState = input ? normalizeOpsState(input.opsState) : normalizeOpsState(view.opsState);
  const latestDecisionLog = input ? (input.latestDecisionLog || null) : (view.latestDecisionLog || null);
  const userStateSummary = input ? (input.userStateSummary || null) : (view.userStateSummary || null);
  const memberSummary = input ? (input.memberSummary || null) : (view.memberSummary || null);
  const allowedNextActions = input
    ? normalizeAllowedNextActions(input.constraints && input.constraints.allowedNextActions)
    : normalizeAllowedNextActions(view.allowedNextActions);

  const constraints = input && input.constraints
    ? {
      allowedNextActions,
      readiness: typeof input.constraints.readiness === 'string'
        ? input.constraints.readiness
        : (readiness && readiness.status ? readiness.status : null)
    }
    : {
      allowedNextActions,
      readiness: readiness && readiness.status ? readiness.status : null
    };

  const system = [
    'You are an ops assistant.',
    'Return a short, readable suggestion for human operators.',
    'Rules:',
    '- Never propose actions outside allowedNextActions.',
    '- If readiness is NOT_READY, propose only STOP_AND_ESCALATE.',
    '- Provide a short reason (<= 1 sentence).',
    '- Advisory only. Do not execute actions.'
  ].join('\n');

  const user = JSON.stringify({
    promptVersion: input && input.promptVersion ? input.promptVersion : PROMPT_VERSION,
    readiness,
    opsState,
    latestDecisionLog,
    userStateSummary,
    memberSummary,
    constraints
  });

  return {
    system,
    user,
    schemaVersion: SCHEMA_VERSION,
    constraints
  };
}

module.exports = {
  buildOpsAssistPrompt,
  SCHEMA_VERSION
};
