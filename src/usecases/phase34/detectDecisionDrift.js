'use strict';

const DRIFT_TYPES = Object.freeze({
  SUGGESTION: 'SUGGESTION_DRIFT',
  EXECUTION: 'EXECUTION_DRIFT',
  OUTCOME: 'OUTCOME_DRIFT',
  POLICY: 'POLICY_DRIFT'
});

const SEVERITY = Object.freeze({
  INFO: 'INFO',
  WARN: 'WARN',
  CRITICAL: 'CRITICAL'
});

const EXPECTED_SIDE_EFFECTS = Object.freeze({
  NO_ACTION: ['no_action'],
  RERUN_MAIN: ['workflow_triggered'],
  FIX_AND_RERUN: ['ops_note_created'],
  STOP_AND_ESCALATE: ['notification_sent']
});

function pickSeverity(driftTypes) {
  if (driftTypes.includes(DRIFT_TYPES.POLICY)) return SEVERITY.CRITICAL;
  if (driftTypes.includes(DRIFT_TYPES.EXECUTION) || driftTypes.includes(DRIFT_TYPES.OUTCOME)) {
    return SEVERITY.WARN;
  }
  if (driftTypes.includes(DRIFT_TYPES.SUGGESTION)) return SEVERITY.INFO;
  return SEVERITY.INFO;
}

function normalizeAction(value) {
  return typeof value === 'string' ? value : '';
}

function extractSuggestedAction(llmSuggestion) {
  if (!llmSuggestion || !Array.isArray(llmSuggestion.suggestedNextActions)) return '';
  const first = llmSuggestion.suggestedNextActions[0];
  return first && typeof first.action === 'string' ? first.action : '';
}

function expectedSideEffects(action) {
  return EXPECTED_SIDE_EFFECTS[action] || [];
}

function includesAll(actual, expected) {
  if (!expected.length) return true;
  if (!Array.isArray(actual)) return false;
  return expected.every((item) => actual.includes(item));
}

async function detectDecisionDrift(params, deps) {
  const payload = params || {};
  const now = deps && typeof deps.nowFn === 'function' ? deps.nowFn() : new Date();

  const llmSuggestion = payload.llmSuggestion || null;
  if (!llmSuggestion) {
    return {
      driftDetected: false,
      driftTypes: [],
      details: [],
      severity: SEVERITY.INFO,
      detectedAt: now.toISOString()
    };
  }

  const decisionLog = payload.decisionLog || {};
  const opsSnapshot = payload.opsDecisionSnapshot || {};
  const executionResult = payload.executionResult || {};

  const opsSelected = normalizeAction(decisionLog.nextAction || opsSnapshot.selectedAction);
  const executionAction = normalizeAction(executionResult.action || (executionResult.execution && executionResult.execution.action));
  const executionSideEffects = executionResult.execution
    ? executionResult.execution.sideEffects
    : executionResult.sideEffects;
  const executionStatus = executionResult.execution
    ? executionResult.execution.result
    : executionResult.result;

  const driftTypes = [];
  const details = [];

  const suggestedAction = extractSuggestedAction(llmSuggestion);
  if (suggestedAction && opsSelected && suggestedAction !== opsSelected) {
    driftTypes.push(DRIFT_TYPES.SUGGESTION);
    details.push({
      type: DRIFT_TYPES.SUGGESTION,
      expected: suggestedAction,
      actual: opsSelected,
      source: 'ops'
    });
  }

  if (opsSelected && executionAction && opsSelected !== executionAction) {
    driftTypes.push(DRIFT_TYPES.EXECUTION);
    details.push({
      type: DRIFT_TYPES.EXECUTION,
      expected: opsSelected,
      actual: executionAction,
      source: 'execution'
    });
  }

  const expectedEffects = expectedSideEffects(executionAction || opsSelected);
  if (executionStatus && executionStatus !== 'SUCCESS') {
    driftTypes.push(DRIFT_TYPES.OUTCOME);
    details.push({
      type: DRIFT_TYPES.OUTCOME,
      expected: 'SUCCESS',
      actual: executionStatus,
      source: 'execution'
    });
  } else if (expectedEffects.length && !includesAll(executionSideEffects, expectedEffects)) {
    driftTypes.push(DRIFT_TYPES.OUTCOME);
    details.push({
      type: DRIFT_TYPES.OUTCOME,
      expected: expectedEffects.join(','),
      actual: Array.isArray(executionSideEffects) ? executionSideEffects.join(',') : 'none',
      source: 'execution'
    });
  }

  const readiness = opsSnapshot.readiness || null;
  const allowedNextActions = Array.isArray(opsSnapshot.allowedNextActions)
    ? opsSnapshot.allowedNextActions
    : [];
  if (opsSelected) {
    if (readiness && readiness.status === 'NOT_READY' && opsSelected !== 'STOP_AND_ESCALATE') {
      driftTypes.push(DRIFT_TYPES.POLICY);
      details.push({
        type: DRIFT_TYPES.POLICY,
        expected: 'STOP_AND_ESCALATE',
        actual: opsSelected,
        source: 'policy'
      });
    } else if (allowedNextActions.length && !allowedNextActions.includes(opsSelected)) {
      driftTypes.push(DRIFT_TYPES.POLICY);
      details.push({
        type: DRIFT_TYPES.POLICY,
        expected: allowedNextActions.join(','),
        actual: opsSelected,
        source: 'policy'
      });
    }
  }

  const uniqueTypes = Array.from(new Set(driftTypes));
  const severity = pickSeverity(uniqueTypes);

  return {
    driftDetected: uniqueTypes.length > 0,
    driftTypes: uniqueTypes,
    details,
    severity,
    detectedAt: now.toISOString()
  };
}

module.exports = {
  detectDecisionDrift,
  DRIFT_TYPES,
  SEVERITY
};
