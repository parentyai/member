'use strict';

const { evaluateAnswerReadiness } = require('./evaluateAnswerReadiness');
const { applyAnswerReadinessDecision } = require('./applyAnswerReadinessDecision');
const { resolveIntentRiskTier } = require('../policy/resolveIntentRiskTier');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDecision(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'allow' || normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return null;
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((row) => {
    const normalized = normalizeText(row).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function normalizeScore(value, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function resolveSharedAnswerReadiness(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeText(payload.domainIntent).toLowerCase() || 'general';
  const risk = resolveIntentRiskTier({ domainIntent });
  const llmUsed = payload.llmUsed === true;

  const explicitDecision = normalizeDecision(payload.readinessDecision);
  const explicitReasonCodes = normalizeReasonCodes(payload.readinessReasonCodes);
  const explicitSafeResponseMode = normalizeText(payload.readinessSafeResponseMode).toLowerCase() || null;

  const evaluated = evaluateAnswerReadiness({
    lawfulBasis: normalizeText(payload.lawfulBasis) || 'consent',
    consentVerified: payload.consentVerified !== false,
    crossBorder: payload.crossBorder === true,
    legalDecision: normalizeText(payload.legalDecision) || 'allow',
    intentRiskTier: risk.intentRiskTier,
    sourceAuthorityScore: normalizeScore(payload.sourceAuthorityScore, llmUsed ? 0.72 : 0.55),
    sourceFreshnessScore: normalizeScore(payload.sourceFreshnessScore, llmUsed ? 0.72 : 0.55),
    sourceReadinessDecision: normalizeText(payload.sourceReadinessDecision) || (llmUsed ? 'allow' : 'clarify'),
    officialOnlySatisfied: payload.officialOnlySatisfied !== false,
    unsupportedClaimCount: Number.isFinite(Number(payload.unsupportedClaimCount))
      ? Number(payload.unsupportedClaimCount)
      : 0,
    contradictionDetected: payload.contradictionDetected === true,
    evidenceCoverage: normalizeScore(payload.evidenceCoverage, llmUsed ? 0.7 : 0.5),
    fallbackType: normalizeText(payload.fallbackType) || null,
    reasonCodes: normalizeReasonCodes([].concat(risk.riskReasonCodes || [], explicitReasonCodes))
  });

  const readiness = explicitDecision
    ? {
      decision: explicitDecision,
      reasonCodes: explicitReasonCodes.length ? explicitReasonCodes : evaluated.reasonCodes,
      safeResponseMode: explicitSafeResponseMode || evaluated.safeResponseMode,
      qualitySnapshot: evaluated.qualitySnapshot
    }
    : evaluated;

  const applied = applyAnswerReadinessDecision({
    decision: readiness.decision,
    replyText: payload.replyText,
    clarifyText: payload.clarifyText,
    refuseText: payload.refuseText
  });

  return {
    readiness,
    domainIntent: risk.domainIntent,
    intentRiskTier: risk.intentRiskTier,
    replyText: applied.replyText,
    readinessEnforced: applied.enforced === true
  };
}

module.exports = {
  resolveSharedAnswerReadiness
};

