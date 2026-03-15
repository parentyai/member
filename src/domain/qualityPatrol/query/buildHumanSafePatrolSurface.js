'use strict';

const {
  buildPatrolBacklogSeparation
} = require('./buildPatrolBacklogSeparation');

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

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())))
    .sort((left, right) => left.localeCompare(right, 'ja'));
}

function mapHumanOverallReadinessStatus(value) {
  switch (value) {
    case 'historical_backlog_dominant':
      return 'readiness_deferred';
    case 'observation_continue_backlog_decay':
      return 'observation_continue';
    case 'current_runtime_or_current_join_problem':
      return 'current_runtime_attention_needed';
    case 'readiness_candidate':
      return 'readiness_candidate';
    default:
      return typeof value === 'string' && value.trim() ? value.trim() : 'unavailable';
  }
}

function buildTranscriptCoverageSummary(payload) {
  const status = payload && payload.transcriptCoverageStatus ? payload.transcriptCoverageStatus : 'unavailable';
  const observedCount = normalizeCount(payload && payload.observedCount);
  const writtenCount = normalizeCount(payload && (payload.writtenCount != null
    ? payload.writtenCount
    : payload.transcriptWriteOutcomeCounts && payload.transcriptWriteOutcomeCounts.written));
  if (status === 'ready') {
    return '最近の会話レビュー用 transcript 記録は安定しています。';
  }
  if (observedCount <= 0) {
    return '会話レビュー用 transcript 記録はまだ十分に観測できていません。';
  }
  if (writtenCount <= 0) {
    return '会話レビュー用 transcript 記録の保存が不安定で、readiness 判定は保留です。';
  }
  return '会話レビュー用 transcript 記録に一部欠落があり、継続観測が必要です。';
}

function buildHumanSafeTranscriptCoverage(transcriptCoverage) {
  const payload = transcriptCoverage && typeof transcriptCoverage === 'object' ? transcriptCoverage : {};
  const outcomes = payload.transcriptWriteOutcomeCounts && typeof payload.transcriptWriteOutcomeCounts === 'object'
    ? payload.transcriptWriteOutcomeCounts
    : {};
  return {
    observedCount: normalizeCount(payload.observedCount),
    writtenCount: normalizeCount(payload.writtenCount != null ? payload.writtenCount : outcomes.written),
    skippedCount: normalizeCount(payload.skippedCount),
    failedCount: normalizeCount(payload.failedCount),
    transcriptCoverageStatus: payload.transcriptCoverageStatus || 'unavailable',
    coverageSummary: buildTranscriptCoverageSummary(payload)
  };
}

function buildHumanSafeDecayAwareReadiness(decayAwareReadiness) {
  const payload = decayAwareReadiness && typeof decayAwareReadiness === 'object' ? decayAwareReadiness : {};
  const recentWindow = payload.recentWindow && typeof payload.recentWindow === 'object' ? payload.recentWindow : {};
  const fullWindow = payload.fullWindow && typeof payload.fullWindow === 'object' ? payload.fullWindow : {};
  const historicalDebt = payload.historicalDebt && typeof payload.historicalDebt === 'object' ? payload.historicalDebt : {};
  const currentRuntimeHealth = payload.currentRuntimeHealth && typeof payload.currentRuntimeHealth === 'object'
    ? payload.currentRuntimeHealth
    : {};

  return {
    recentWindowStatus: payload.recentWindowStatus || 'unavailable',
    historicalBacklogStatus: payload.historicalBacklogStatus || 'unavailable',
    overallReadinessStatus: mapHumanOverallReadinessStatus(payload.overallReadinessStatus),
    recentWindow: {
      sourceWindow: cloneWindow(recentWindow.sourceWindow),
      observedCount: normalizeCount(recentWindow.observedCount),
      written: normalizeCount(recentWindow.written),
      reviewUnitCount: normalizeCount(recentWindow.reviewUnitCount)
    },
    fullWindow: {
      sourceWindow: cloneWindow(fullWindow.sourceWindow),
      observedCount: normalizeCount(fullWindow.observedCount),
      written: normalizeCount(fullWindow.written),
      reviewUnitCount: normalizeCount(fullWindow.reviewUnitCount)
    },
    historicalDebt: {
      status: payload.historicalBacklogStatus || 'unavailable',
      trend: historicalDebt.trend || 'unavailable',
      debtCount: normalizeCount(historicalDebt.transcriptDebtCount) + normalizeCount(historicalDebt.joinDebtCount),
      blockerCount: normalizeCount(historicalDebt.blockerCount)
    },
    currentRuntimeHealth: {
      status: currentRuntimeHealth.status || 'unavailable',
      observedCount: normalizeCount(currentRuntimeHealth.observedCount),
      reviewUnitCount: normalizeCount(currentRuntimeHealth.reviewUnitCount),
      transcriptWriteCoverageHealthy: currentRuntimeHealth.transcriptWriteCoverageHealthy === true,
      joinHealthy: currentRuntimeHealth.joinHealthy === true
    }
  };
}

function fallbackHumanOperatorAction(decision, reasonCode) {
  if (decision === 'GO') return 'readiness の再判定へ進めます。';
  if (decision === 'OBSERVATION_CONTINUE') return '過去期間の負債を current runtime と分けて継続観測します。';
  if (reasonCode === 'current_runtime_or_current_join_problem') {
    return '現在の runtime または結合証跡を先に修復します。';
  }
  return '現在の runtime は安定していますが、過去期間の負債が残るため readiness は見送ります。';
}

function buildHumanSafeDecayAwareOpsGate(decayAwareOpsGate, backlogSeparation) {
  const payload = decayAwareOpsGate && typeof decayAwareOpsGate === 'object' ? decayAwareOpsGate : {};
  const gate = backlogSeparation && backlogSeparation.backlogSeparationGate && typeof backlogSeparation.backlogSeparationGate === 'object'
    ? backlogSeparation.backlogSeparationGate
    : null;
  return {
    decision: payload.decision || (gate && gate.decision) || 'NO_GO',
    operatorAction: gate && gate.operatorAction
      ? gate.operatorAction
      : fallbackHumanOperatorAction(payload.decision, payload.decisionReasonCode),
    prDStatus: payload.prDStatus || (gate && gate.prDStatus) || 'deferred',
    recentWindowStatus: payload.recentWindowStatus || 'unavailable',
    historicalBacklogStatus: payload.historicalBacklogStatus || 'unavailable'
  };
}

function sanitizeHumanObservationBlockerRow(row) {
  const payload = row && typeof row === 'object' ? row : {};
  return {
    title: payload.title || '観測不足があります',
    summary: payload.summary || 'readiness を判断するための観測が不足しています。',
    affectedSlices: Array.isArray(payload.affectedSlices) ? payload.affectedSlices.slice() : [],
    recommendedAction: payload.recommendedAction || '観測条件を確認してから次の判断に進んでください。',
    privacySensitivity: payload.privacySensitivity || 'privacy_hidden_detail',
    detailVisibility: payload.detailVisibility || 'privacy_hidden_detail'
  };
}

function sanitizeHumanObservationBlockers(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => sanitizeHumanObservationBlockerRow(row));
}

function buildHumanSafeRootCauseResult(rootCauseResult) {
  const payload = rootCauseResult && typeof rootCauseResult === 'object' ? rootCauseResult : {};
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  return {
    summary: {
      reportCount: normalizeCount(summary.reportCount),
      analyzedCount: normalizeCount(summary.analyzedCount),
      blockedCount: normalizeCount(summary.blockedCount),
      insufficientEvidenceCount: normalizeCount(summary.insufficientEvidenceCount)
    },
    rootCauseReports: (Array.isArray(payload.rootCauseReports) ? payload.rootCauseReports : []).map((report) => ({
      slice: report && report.slice ? report.slice : 'global',
      analysisStatus: report && report.analysisStatus ? report.analysisStatus : 'insufficient_evidence',
      rootCauseSummary: report && report.rootCauseSummary ? report.rootCauseSummary : '原因候補の分析があります。'
    })),
    provenance: payload.provenance || 'quality_patrol_root_cause_analysis',
    sourceCollections: uniqueStrings(payload.sourceCollections)
  };
}

function buildHumanSafePlanResult(planResult) {
  const payload = planResult && typeof planResult === 'object' ? planResult : {};
  const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
  return {
    ok: payload.ok === true,
    planVersion: payload.planVersion || 'quality_patrol_improvement_plan_v1',
    generatedAt: payload.generatedAt || null,
    summary: {
      topPriorityCount: normalizeCount(summary.topPriorityCount),
      observationOnlyCount: normalizeCount(summary.observationOnlyCount),
      runtimeFixCount: normalizeCount(summary.runtimeFixCount)
    },
    recommendedPr: (Array.isArray(payload.recommendedPr) ? payload.recommendedPr : []).map((item) => ({
      title: item && item.title ? item.title : 'Quality Patrol proposal',
      priority: item && item.priority ? item.priority : 'P2',
      objective: item && item.objective ? item.objective : 'Quality Patrol の改善候補です。',
      riskLevel: item && item.riskLevel ? item.riskLevel : 'medium',
      changeStatus: item && item.changeStatus ? item.changeStatus : undefined
    })),
    observationBlockers: sanitizeHumanObservationBlockers(payload.observationBlockers),
    planningStatus: payload.planningStatus || 'insufficient_evidence',
    provenance: payload.provenance || 'quality_patrol_improvement_planner',
    sourceCollections: uniqueStrings(payload.sourceCollections)
  };
}

function buildHumanSafePatrolSurface(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const backlogSeparation = payload.backlogSeparation || buildPatrolBacklogSeparation({
    audience: 'human',
    decayAwareReadiness: payload.decayAwareReadiness,
    decayAwareOpsGate: payload.decayAwareOpsGate
  });

  return {
    transcriptCoverage: buildHumanSafeTranscriptCoverage(payload.transcriptCoverage),
    decayAwareReadiness: buildHumanSafeDecayAwareReadiness(payload.decayAwareReadiness),
    decayAwareOpsGate: buildHumanSafeDecayAwareOpsGate(payload.decayAwareOpsGate, backlogSeparation),
    rootCauseResult: buildHumanSafeRootCauseResult(payload.rootCauseResult),
    planResult: buildHumanSafePlanResult(payload.planResult)
  };
}

module.exports = {
  buildHumanSafeTranscriptCoverage,
  buildHumanSafeDecayAwareReadiness,
  buildHumanSafeDecayAwareOpsGate,
  sanitizeHumanObservationBlockerRow,
  sanitizeHumanObservationBlockers,
  buildHumanSafeRootCauseResult,
  buildHumanSafePlanResult,
  buildHumanSafePatrolSurface
};
