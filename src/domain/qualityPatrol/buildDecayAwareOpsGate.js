'use strict';

function createEmptyDecayAwareOpsGate() {
  return {
    gateVersion: 'quality_patrol_decay_ops_gate_v1',
    decision: 'NO_GO',
    decisionReasonCode: 'unavailable',
    operatorAction: 'recheck_observation_inputs',
    recentWindowStatus: 'unavailable',
    historicalBacklogStatus: 'unavailable',
    overallReadinessStatus: 'unavailable',
    prDEligible: false,
    prDStatus: 'deferred',
    prDReasonCode: 'non_copy_blockers_present'
  };
}

function resolveDecision(overallReadinessStatus) {
  switch (overallReadinessStatus) {
    case 'readiness_candidate':
      return 'GO';
    case 'observation_continue_backlog_decay':
      return 'OBSERVATION_CONTINUE';
    case 'historical_backlog_dominant':
      return 'NO_GO';
    case 'current_runtime_or_current_join_problem':
      return 'NO_GO';
    default:
      return 'NO_GO';
  }
}

function resolveOperatorAction(overallReadinessStatus) {
  switch (overallReadinessStatus) {
    case 'readiness_candidate':
      return 'review_readiness_candidate';
    case 'observation_continue_backlog_decay':
      return 'continue_backlog_decay_observation';
    case 'historical_backlog_dominant':
      return 'separate_historical_backlog_from_current_runtime';
    case 'current_runtime_or_current_join_problem':
      return 'repair_current_runtime_or_current_join';
    default:
      return 'recheck_observation_inputs';
  }
}

function buildPrDStatus(payload) {
  const currentRuntimeHealth = payload && payload.currentRuntimeHealth && typeof payload.currentRuntimeHealth === 'object'
    ? payload.currentRuntimeHealth
    : {};
  const historicalBacklogStatus = payload && typeof payload.historicalBacklogStatus === 'string'
    ? payload.historicalBacklogStatus
    : 'unavailable';
  const overallReadinessStatus = payload && typeof payload.overallReadinessStatus === 'string'
    ? payload.overallReadinessStatus
    : 'unavailable';

  if (currentRuntimeHealth.status !== 'healthy') {
    return {
      prDEligible: false,
      prDStatus: 'deferred',
      prDReasonCode: 'current_runtime_not_healthy'
    };
  }
  if (historicalBacklogStatus === 'stagnating' || historicalBacklogStatus === 'current_runtime_overlap') {
    return {
      prDEligible: false,
      prDStatus: 'deferred',
      prDReasonCode: 'historical_backlog_present'
    };
  }
  if (overallReadinessStatus !== 'readiness_candidate') {
    return {
      prDEligible: false,
      prDStatus: 'deferred',
      prDReasonCode: 'non_copy_blockers_present'
    };
  }
  return {
    prDEligible: true,
    prDStatus: 'eligible',
    prDReasonCode: 'copy_only_follow_up'
  };
}

function buildDecayAwareOpsGate(decayAwareReadiness) {
  const payload = decayAwareReadiness && typeof decayAwareReadiness === 'object'
    ? decayAwareReadiness
    : createEmptyDecayAwareOpsGate();
  const overallReadinessStatus = typeof payload.overallReadinessStatus === 'string'
    ? payload.overallReadinessStatus
    : 'unavailable';
  const recentWindowStatus = typeof payload.recentWindowStatus === 'string'
    ? payload.recentWindowStatus
    : 'unavailable';
  const historicalBacklogStatus = typeof payload.historicalBacklogStatus === 'string'
    ? payload.historicalBacklogStatus
    : 'unavailable';
  const prD = buildPrDStatus(payload);
  return {
    gateVersion: 'quality_patrol_decay_ops_gate_v1',
    decision: resolveDecision(overallReadinessStatus),
    decisionReasonCode: overallReadinessStatus,
    operatorAction: resolveOperatorAction(overallReadinessStatus),
    recentWindowStatus,
    historicalBacklogStatus,
    overallReadinessStatus,
    prDEligible: prD.prDEligible,
    prDStatus: prD.prDStatus,
    prDReasonCode: prD.prDReasonCode
  };
}

module.exports = {
  buildDecayAwareOpsGate,
  createEmptyDecayAwareOpsGate
};
