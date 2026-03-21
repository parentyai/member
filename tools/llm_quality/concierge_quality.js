'use strict';

const CONCIERGE_RUNTIME_SIGNAL_RULES = Object.freeze({
  formatComplianceRate: { threshold: 0.95, direction: 'min', label: 'Format compliance rate' },
  detailCarryRate: { threshold: 0.9, direction: 'min', label: 'Detail carry rate' },
  correctionRecoveryRate: { threshold: 0.9, direction: 'min', label: 'Correction recovery rate' },
  mixedDomainRetentionRate: { threshold: 0.9, direction: 'min', label: 'Mixed-domain retention rate' },
  followupOveraskRate: { threshold: 0.05, direction: 'max', label: 'Follow-up overask rate' },
  internalLabelLeakRate: { threshold: 0, direction: 'max', label: 'Internal label leak rate' },
  parrotEchoRate: { threshold: 0, direction: 'max', label: 'Parrot-echo rate' },
  commandBoundaryCollisionRate: { threshold: 0, direction: 'max', label: 'Command boundary collision rate' },
  domainIntentConciergeRate: { threshold: 0.9, direction: 'min', label: 'Domain intent concierge rate' },
  officialOnlySatisfiedRate: { threshold: 0.9, direction: 'min', label: 'Official-only satisfied rate' },
  followupResolutionRate: { threshold: 0.85, direction: 'min', label: 'Follow-up resolution rate' },
  contextualResumeHandledRate: { threshold: 0.85, direction: 'min', label: 'Contextual resume handled rate' },
  avgUnsupportedClaimCount: { threshold: 0.05, direction: 'max', label: 'Unsupported claim count' }
});

const CONCIERGE_RUNTIME_SIGNAL_KEYS = Object.freeze(Object.keys(CONCIERGE_RUNTIME_SIGNAL_RULES));

const CONCIERGE_CRITICAL_SLICE_KEYS = Object.freeze([
  'emergency_high_risk',
  'saved_faq_high_risk_reuse',
  'journey_blocker_conflict',
  'stale_city_pack_required_source',
  'compat_spike',
  'trace_join_incomplete',
  'direct_url_leakage',
  'official_source_missing_on_high_risk'
]);

function toConversationQuality(summary) {
  if (!summary || typeof summary !== 'object') return {};
  const conversation = summary.conversationQuality && typeof summary.conversationQuality === 'object'
    ? summary.conversationQuality
    : {};
  return conversation;
}

function toQualityLoopV2(summary) {
  if (!summary || typeof summary !== 'object') return null;
  const qualityFramework = summary.qualityFramework && typeof summary.qualityFramework === 'object'
    ? summary.qualityFramework
    : null;
  if (!qualityFramework || !qualityFramework.qualityLoopV2 || typeof qualityFramework.qualityLoopV2 !== 'object') {
    return null;
  }
  return qualityFramework.qualityLoopV2;
}

function normalizeFiniteNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function buildConciergeRuntimeSignalRows(summary) {
  const conversation = toConversationQuality(summary);
  return CONCIERGE_RUNTIME_SIGNAL_KEYS.map((signal) => {
    const rule = CONCIERGE_RUNTIME_SIGNAL_RULES[signal];
    const value = normalizeFiniteNumber(conversation[signal]);
    const available = value != null;
    const pass = available
      ? (rule.direction === 'max' ? value <= rule.threshold : value >= rule.threshold)
      : false;
    return {
      signal,
      label: rule.label,
      value,
      available,
      threshold: rule.threshold,
      direction: rule.direction,
      gap: !available
        ? null
        : rule.direction === 'max'
          ? Number(Math.max(0, value - rule.threshold).toFixed(4))
          : Number(Math.max(0, rule.threshold - value).toFixed(4)),
      status: available ? (pass ? 'pass' : 'fail') : 'missing'
    };
  });
}

function buildConciergeRuntimeFailures(summary) {
  return buildConciergeRuntimeSignalRows(summary)
    .filter((row) => row.status !== 'pass')
    .sort((left, right) => {
      const leftGap = Number.isFinite(Number(left.gap)) ? Number(left.gap) : Number.POSITIVE_INFINITY;
      const rightGap = Number.isFinite(Number(right.gap)) ? Number(right.gap) : Number.POSITIVE_INFINITY;
      if (leftGap !== rightGap) return rightGap - leftGap;
      return left.signal.localeCompare(right.signal, 'ja');
    })
    .slice(0, 10);
}

function buildConciergeCriticalIssues(summary) {
  const qualityLoopV2 = toQualityLoopV2(summary);
  if (!qualityLoopV2) return [];
  const criticalSlices = Array.isArray(qualityLoopV2.criticalSlices) ? qualityLoopV2.criticalSlices : [];
  const integrationKpis = qualityLoopV2.integrationKpis && typeof qualityLoopV2.integrationKpis === 'object'
    ? qualityLoopV2.integrationKpis
    : {};
  const rows = [];
  criticalSlices.forEach((slice) => {
    if (!slice || typeof slice !== 'object') return;
    const issueCode = typeof slice.sliceKey === 'string' && slice.sliceKey.trim() ? slice.sliceKey.trim() : 'unknown';
    const metric = issueCode && slice.sourceMetric && integrationKpis[slice.sourceMetric] && typeof integrationKpis[slice.sourceMetric] === 'object'
      ? integrationKpis[slice.sourceMetric]
      : {};
    const status = typeof slice.status === 'string' ? slice.status : (metric.status || 'missing');
    const blocked = slice.blocked === true || status !== 'pass' || metric.status !== 'pass';
    if (!blocked) return;
    rows.push({
      issueCode,
      sliceKey: issueCode,
      sourceMetric: typeof slice.sourceMetric === 'string' ? slice.sourceMetric : null,
      status,
      blocked,
      metricStatus: typeof metric.status === 'string' ? metric.status : 'missing',
      metricValue: normalizeFiniteNumber(metric.value),
      sampleCount: Number.isFinite(Number(metric.sampleCount)) ? Math.max(0, Math.floor(Number(metric.sampleCount))) : null,
      severity: 'high'
    });
  });

  const missingJoins = Array.isArray(qualityLoopV2.missingJoins) ? qualityLoopV2.missingJoins : [];
  missingJoins.forEach((join) => {
    const issueCode = typeof join === 'string' && join.trim() ? `missing_join:${join.trim()}` : '';
    if (!issueCode) return;
    rows.push({
      issueCode,
      sliceKey: join.trim(),
      sourceMetric: 'missingJoins',
      status: 'missing',
      blocked: true,
      metricStatus: 'missing',
      metricValue: null,
      sampleCount: null,
      severity: 'high'
    });
  });

  return rows;
}

function buildConciergeReleaseSupport(summary) {
  const runtimeSignals = buildConciergeRuntimeSignalRows(summary);
  const runtimeFailures = runtimeSignals.filter((row) => row.status !== 'pass');
  const criticalIssues = buildConciergeCriticalIssues(summary);
  const missingSignalCount = runtimeSignals.filter((row) => row.status === 'missing').length;
  const availableSignalCount = runtimeSignals.length - missingSignalCount;
  return {
    runtimeSignals,
    runtimeFailures,
    criticalIssues,
    criticalIssueCodes: Array.from(new Set(criticalIssues.map((row) => row.issueCode))).sort((left, right) => left.localeCompare(right, 'ja')),
    signalCoverage: {
      requiredSignalCount: CONCIERGE_RUNTIME_SIGNAL_KEYS.length,
      availableSignalCount,
      missingSignalCount,
      missingSignals: runtimeSignals.filter((row) => row.status === 'missing').map((row) => row.signal)
    },
    criticalIssueCount: criticalIssues.length
  };
}

module.exports = {
  CONCIERGE_RUNTIME_SIGNAL_RULES,
  CONCIERGE_RUNTIME_SIGNAL_KEYS,
  CONCIERGE_CRITICAL_SLICE_KEYS,
  buildConciergeRuntimeSignalRows,
  buildConciergeRuntimeFailures,
  buildConciergeCriticalIssues,
  buildConciergeReleaseSupport
};
