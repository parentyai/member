'use strict';

const { resolveAudienceView } = require('./resolveAudienceView');

function normalizeCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function cloneWindow(sourceWindow) {
  const payload = sourceWindow && typeof sourceWindow === 'object' ? sourceWindow : {};
  return {
    fromAt: payload.fromAt || null,
    toAt: payload.toAt || null
  };
}

function computeDebtCount(fullWindow, recentWindow, key) {
  return Math.max(0, normalizeCount(fullWindow && fullWindow[key]) - normalizeCount(recentWindow && recentWindow[key]));
}

function mapHistoricalDebtStatus(readinessStatus, totalDebtCount) {
  if (readinessStatus === 'cleared') return 'cleared';
  if (readinessStatus === 'decaying') return 'decaying';
  if (readinessStatus === 'stagnating') return 'stagnating';
  if (readinessStatus === 'current_runtime_overlap') return totalDebtCount > 0 ? 'present' : 'cleared';
  return readinessStatus === 'unavailable' ? 'unavailable' : (totalDebtCount > 0 ? 'present' : 'cleared');
}

function humanOperatorAction(decision, reasonCode) {
  if (decision === 'GO') return 'readiness の再判定へ進めます。';
  if (decision === 'OBSERVATION_CONTINUE') return '過去期間の負債を current runtime と分けて観測継続します。';
  if (reasonCode === 'current_runtime_or_current_join_problem') {
    return '現在の runtime または結合証跡を先に修復します。';
  }
  if (reasonCode === 'historical_backlog_dominant') {
    return '過去期間の負債を current runtime と分けたまま解消を待ちます。';
  }
  return '観測入力を再確認してから次の判断に進みます。';
}

function buildOperatorBacklogSeparation(decayAwareReadiness, decayAwareOpsGate) {
  const readiness = decayAwareReadiness && typeof decayAwareReadiness === 'object'
    ? decayAwareReadiness
    : {};
  const gate = decayAwareOpsGate && typeof decayAwareOpsGate === 'object'
    ? decayAwareOpsGate
    : {};
  const recentWindow = readiness.recentWindow && typeof readiness.recentWindow === 'object'
    ? readiness.recentWindow
    : {};
  const fullWindow = readiness.fullWindow && typeof readiness.fullWindow === 'object'
    ? readiness.fullWindow
    : {};
  const historicalDebt = readiness.historicalDebt && typeof readiness.historicalDebt === 'object'
    ? readiness.historicalDebt
    : {};
  const currentRuntimeHealth = readiness.currentRuntimeHealth && typeof readiness.currentRuntimeHealth === 'object'
    ? readiness.currentRuntimeHealth
    : {};

  const debtCounts = {
    skipped_unreviewable_transcript: computeDebtCount(fullWindow, recentWindow, 'skipped_unreviewable_transcript'),
    assistant_reply_missing: computeDebtCount(fullWindow, recentWindow, 'assistant_reply_missing'),
    faq_only_rows_skipped: computeDebtCount(fullWindow, recentWindow, 'faqOnlyRowsSkipped'),
    action_trace_join_limited: computeDebtCount(fullWindow, recentWindow, 'traceHydrationLimitedCount'),
    blocker_count: computeDebtCount(fullWindow, recentWindow, 'blockerCount')
  };
  const totalDebtCount = normalizeCount(
    historicalDebt.totalDebtCount != null
      ? historicalDebt.totalDebtCount
      : Object.values(debtCounts).reduce((sum, value) => sum + normalizeCount(value), 0)
  );
  const observationOnlyBlockerCount = normalizeCount(historicalDebt.observationOnlyBlockerCount);

  return {
    contractVersion: 'quality_patrol_backlog_separation_v1',
    audience: 'operator',
    currentRuntime: {
      status: typeof currentRuntimeHealth.status === 'string' ? currentRuntimeHealth.status : 'unavailable',
      window: cloneWindow(recentWindow.sourceWindow),
      observedCount: normalizeCount(currentRuntimeHealth.observedCount || recentWindow.observedCount),
      reviewUnitCount: normalizeCount(currentRuntimeHealth.reviewUnitCount || recentWindow.reviewUnitCount),
      transcriptWriteCoverageHealthy: currentRuntimeHealth.transcriptWriteCoverageHealthy === true,
      joinHealthy: currentRuntimeHealth.joinHealthy === true
    },
    historicalDebt: {
      status: mapHistoricalDebtStatus(readiness.historicalBacklogStatus, totalDebtCount),
      readinessStatus: typeof readiness.historicalBacklogStatus === 'string' ? readiness.historicalBacklogStatus : 'unavailable',
      trend: typeof historicalDebt.trend === 'string' ? historicalDebt.trend : 'unavailable',
      window: cloneWindow(fullWindow.sourceWindow),
      observedCount: normalizeCount(fullWindow.observedCount),
      reviewUnitCount: normalizeCount(fullWindow.reviewUnitCount),
      debtCounts,
      totalDebtCount,
      transcriptDebtCount: normalizeCount(historicalDebt.transcriptDebtCount),
      joinDebtCount: normalizeCount(historicalDebt.joinDebtCount),
      dominantDebt: typeof historicalDebt.dominantDebt === 'string' ? historicalDebt.dominantDebt : 'transcript_coverage',
      blockerCount: normalizeCount(historicalDebt.blockerCount || debtCounts.blocker_count),
      observationOnlyBlockerCount
    },
    backlogSeparationGate: {
      decision: typeof gate.decision === 'string' ? gate.decision : 'NO_GO',
      reasonCode: typeof gate.decisionReasonCode === 'string'
        ? gate.decisionReasonCode
        : (typeof readiness.overallReadinessStatus === 'string' ? readiness.overallReadinessStatus : 'unavailable'),
      operatorAction: typeof gate.operatorAction === 'string' ? gate.operatorAction : 'recheck_observation_inputs',
      prDEligible: gate.prDEligible === true,
      prDStatus: typeof gate.prDStatus === 'string' ? gate.prDStatus : 'deferred',
      prDReasonCode: typeof gate.prDReasonCode === 'string' ? gate.prDReasonCode : 'non_copy_blockers_present',
      recentWindowStatus: typeof readiness.recentWindowStatus === 'string' ? readiness.recentWindowStatus : 'unavailable',
      historicalBacklogStatus: typeof readiness.historicalBacklogStatus === 'string' ? readiness.historicalBacklogStatus : 'unavailable',
      overallReadinessStatus: typeof readiness.overallReadinessStatus === 'string' ? readiness.overallReadinessStatus : 'unavailable'
    }
  };
}

function buildHumanBacklogSeparation(operatorView) {
  return {
    contractVersion: operatorView.contractVersion,
    audience: 'human',
    currentRuntime: {
      status: operatorView.currentRuntime.status,
      window: cloneWindow(operatorView.currentRuntime.window),
      observedCount: normalizeCount(operatorView.currentRuntime.observedCount),
      reviewUnitCount: normalizeCount(operatorView.currentRuntime.reviewUnitCount)
    },
    historicalDebt: {
      status: operatorView.historicalDebt.status,
      trend: operatorView.historicalDebt.trend,
      window: cloneWindow(operatorView.historicalDebt.window),
      observedCount: normalizeCount(operatorView.historicalDebt.observedCount),
      reviewUnitCount: normalizeCount(operatorView.historicalDebt.reviewUnitCount),
      debtCount: normalizeCount(operatorView.historicalDebt.totalDebtCount),
      observationOnlyBlockerCount: normalizeCount(operatorView.historicalDebt.observationOnlyBlockerCount)
    },
    backlogSeparationGate: {
      decision: operatorView.backlogSeparationGate.decision,
      operatorAction: humanOperatorAction(
        operatorView.backlogSeparationGate.decision,
        operatorView.backlogSeparationGate.reasonCode
      ),
      prDStatus: operatorView.backlogSeparationGate.prDStatus
    }
  };
}

function buildPatrolBacklogSeparation(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const audience = resolveAudienceView(payload.audience);
  const operatorView = buildOperatorBacklogSeparation(payload.decayAwareReadiness, payload.decayAwareOpsGate);
  if (audience === 'human') return buildHumanBacklogSeparation(operatorView);
  return operatorView;
}

function createEmptyPatrolBacklogSeparation(audience) {
  return buildPatrolBacklogSeparation({
    audience,
    decayAwareReadiness: null,
    decayAwareOpsGate: null
  });
}

module.exports = {
  buildPatrolBacklogSeparation,
  createEmptyPatrolBacklogSeparation
};
