'use strict';

const DEFAULT_LIMIT = 10;

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function normalizeCategory(value) {
  return normalizeText(value).toLowerCase() || 'unknown';
}

function normalizeSignal(value) {
  return normalizeText(value).toLowerCase() || 'unknown';
}

function severityRank(value) {
  const v = normalizeText(value).toLowerCase();
  if (v === 'high') return 0;
  if (v === 'medium') return 1;
  return 2;
}

function defaultSeverityByCategory(category) {
  const key = normalizeCategory(category);
  if (key === 'quality_failure') return 'high';
  if (key === 'loop_case') return 'high';
  if (key === 'context_loss_case') return 'high';
  if (key === 'jp_service_failure') return 'medium';
  if (key === 'line_fit_failure') return 'medium';
  return 'low';
}

function classifyCounterexampleSignal(entry) {
  const signal = normalizeSignal(entry && entry.signal);
  const category = normalizeCategory(entry && entry.category);
  if (
    signal.includes('offtarget')
    || signal.includes('relevancefit')
    || signal.includes('saved_faq_intent_mismatch')
  ) {
    return {
      counterexampleId: 'CE-14',
      owner: 'knowledge_orchestrator',
      remediation: 'enforce runtime intent-fit guards and preserve low-friction school one-step answers before saved FAQ reuse'
    };
  }
  if (signal.includes('default_casual') || category.includes('loop')) {
    return {
      counterexampleId: 'CE-06',
      owner: 'conversation_orchestrator',
      remediation: 'reduce generic clarify loops and prioritize contextual direct answers'
    };
  }
  if (signal.includes('legacytemplate') || signal.includes('japanese_service') || category.includes('jp_service')) {
    return {
      counterexampleId: 'CE-04',
      owner: 'style_engine',
      remediation: 'enforce Japanese service style guard and concise natural phrasing'
    };
  }
  if (signal.includes('minority') || signal.includes('cultural')) {
    return {
      counterexampleId: 'CE-03',
      owner: 'quality_eval',
      remediation: 'extend minority/cultural fixtures and reweight slice checks'
    };
  }
  if (signal.includes('profile') || signal.includes('memory') || category.includes('context_loss')) {
    return {
      counterexampleId: 'CE-01',
      owner: 'memory_policy',
      remediation: 'prioritize current turn and contextual lane over stale profile memory'
    };
  }
  if (
    signal.includes('freshness')
    || signal.includes('source')
    || signal.includes('retrieve')
    || signal.includes('retrieval')
  ) {
    return {
      counterexampleId: 'CE-08',
      owner: 'retrieval_verification',
      remediation: 'tighten source freshness/authority checks and downgrade stale evidence'
    };
  }
  return {
    counterexampleId: 'CE-02',
    owner: 'audit_traceability',
    remediation: 'improve trace completeness and action-level evidence references'
  };
}

function buildCounterexampleQueueFromSignalEntries(entries, options) {
  const rows = Array.isArray(entries) ? entries : [];
  const settings = options && typeof options === 'object' ? options : {};
  const max = Math.max(1, Math.floor(Number(settings.limit) || DEFAULT_LIMIT));
  const queue = [];
  const seen = new Set();

  rows
    .slice()
    .sort((a, b) => {
      const severityCmp = severityRank(a && a.severity) - severityRank(b && b.severity);
      if (severityCmp !== 0) return severityCmp;
      return Number((a && a.rank) || 99) - Number((b && b.rank) || 99);
    })
    .forEach((entry) => {
      const signal = normalizeSignal(entry && entry.signal) || 'unknown';
      const category = normalizeCategory(entry && entry.category) || 'unknown';
      const mapping = classifyCounterexampleSignal({ category, signal });
      const key = `${mapping.counterexampleId}:${signal}`;
      if (seen.has(key)) return;
      seen.add(key);
      queue.push({
        counterexampleId: mapping.counterexampleId,
        signal,
        category,
        severity: normalizeText(entry && entry.severity) || defaultSeverityByCategory(category),
        owner: mapping.owner,
        remediation: mapping.remediation,
        count: Number.isFinite(Number(entry && entry.count)) ? Number(entry.count) : 1,
        status: 'open'
      });
    });

  return queue.slice(0, max);
}

module.exports = {
  classifyCounterexampleSignal,
  buildCounterexampleQueueFromSignalEntries
};
