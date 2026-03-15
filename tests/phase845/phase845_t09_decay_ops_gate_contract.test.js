'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDecayAwareOpsGate
} = require('../../src/domain/qualityPatrol/buildDecayAwareOpsGate');

function buildReadiness(overrides) {
  return Object.assign({
    recentWindowStatus: 'healthy',
    historicalBacklogStatus: 'stagnating',
    overallReadinessStatus: 'historical_backlog_dominant',
    currentRuntimeHealth: {
      status: 'healthy',
      observedCount: 5,
      reviewUnitCount: 5,
      transcriptWriteCoverageHealthy: true,
      joinHealthy: true
    }
  }, overrides || {});
}

test('phase845: historical backlog dominant resolves no-go and keeps PR-D deferred', () => {
  const result = buildDecayAwareOpsGate(buildReadiness());
  assert.equal(result.decision, 'NO_GO');
  assert.equal(result.decisionReasonCode, 'historical_backlog_dominant');
  assert.equal(result.operatorAction, 'separate_historical_backlog_from_current_runtime');
  assert.equal(result.prDEligible, false);
  assert.equal(result.prDStatus, 'deferred');
  assert.equal(result.prDReasonCode, 'historical_backlog_present');
});

test('phase845: current runtime problem resolves no-go and repair action', () => {
  const result = buildDecayAwareOpsGate(buildReadiness({
    recentWindowStatus: 'unhealthy',
    historicalBacklogStatus: 'current_runtime_overlap',
    overallReadinessStatus: 'current_runtime_or_current_join_problem',
    currentRuntimeHealth: {
      status: 'unhealthy',
      observedCount: 5,
      reviewUnitCount: 5,
      transcriptWriteCoverageHealthy: false,
      joinHealthy: false
    }
  }));
  assert.equal(result.decision, 'NO_GO');
  assert.equal(result.operatorAction, 'repair_current_runtime_or_current_join');
  assert.equal(result.prDEligible, false);
  assert.equal(result.prDReasonCode, 'current_runtime_not_healthy');
});

test('phase845: decaying backlog resolves observation continue while PR-D stays deferred', () => {
  const result = buildDecayAwareOpsGate(buildReadiness({
    historicalBacklogStatus: 'decaying',
    overallReadinessStatus: 'observation_continue_backlog_decay'
  }));
  assert.equal(result.decision, 'OBSERVATION_CONTINUE');
  assert.equal(result.operatorAction, 'continue_backlog_decay_observation');
  assert.equal(result.prDEligible, false);
  assert.equal(result.prDReasonCode, 'non_copy_blockers_present');
});

test('phase845: readiness candidate resolves go and PR-D eligibility', () => {
  const result = buildDecayAwareOpsGate(buildReadiness({
    historicalBacklogStatus: 'cleared',
    overallReadinessStatus: 'readiness_candidate'
  }));
  assert.equal(result.decision, 'GO');
  assert.equal(result.operatorAction, 'review_readiness_candidate');
  assert.equal(result.prDEligible, true);
  assert.equal(result.prDStatus, 'eligible');
  assert.equal(result.prDReasonCode, 'copy_only_follow_up');
});
