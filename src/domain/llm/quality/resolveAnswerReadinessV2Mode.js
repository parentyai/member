'use strict';

const { resolveBooleanEnvFlag } = require('../../../v1/shared/flags');

const SOFT_ENTRY_TYPES = new Set(['faq', 'admin', 'compat']);
const HARD_ENTRY_TYPES = new Set(['webhook', 'paid', 'concierge', 'orchestrator']);
const SOFT_CRITICAL_REASON_CODES = new Set([
  'legal_blocked',
  'emergency_official_source_missing',
  'city_pack_required_source_blocked',
  'official_only_not_satisfied',
  'saved_faq_high_risk_not_ready',
  'source_readiness_refuse',
  'unsupported_claim_high_risk'
]);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDecision(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'allow' || normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return 'allow';
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((value) => {
    const normalized = normalizeText(value).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function resolveRolloutStage(flags) {
  if (flags.nogoGate === true && flags.enforceWebhook === true) return 'nogo_gate_mandatory';
  if (flags.enforceWebhook === true) return 'hard_enforcement';
  if (flags.enforce === true) return 'soft_enforcement';
  if (flags.logOnly === true) return 'log_only';
  return 'design_only';
}

function resolveAnswerReadinessV2Mode(params, env) {
  const payload = params && typeof params === 'object' ? params : {};
  const source = env && typeof env === 'object' ? env : process.env;
  const entryType = normalizeText(payload.entryType).toLowerCase() || 'unknown';
  const readinessLegacy = payload.readinessLegacy && typeof payload.readinessLegacy === 'object'
    ? payload.readinessLegacy
    : { decision: 'allow', reasonCodes: [] };
  const readinessV2 = payload.readinessV2 && typeof payload.readinessV2 === 'object'
    ? payload.readinessV2
    : { decision: 'allow', reasonCodes: [] };

  const flags = {
    logOnly: resolveBooleanEnvFlag('ENABLE_ANSWER_READINESS_V2_LOG_ONLY', true, source),
    enforce: resolveBooleanEnvFlag('ENABLE_ANSWER_READINESS_V2_ENFORCE', false, source),
    enforceWebhook: resolveBooleanEnvFlag('ENABLE_ANSWER_READINESS_V2_ENFORCE_WEBHOOK', false, source),
    nogoGate: resolveBooleanEnvFlag('ENABLE_LLM_QUALITY_LOOP_V2_NOGO_GATE', false, source)
  };
  const stage = resolveRolloutStage(flags);
  const legacyDecision = normalizeDecision(readinessLegacy.decision);
  const v2Decision = normalizeDecision(readinessV2.decision);
  const v2ReasonCodes = normalizeReasonCodes(readinessV2.reasonCodes);
  const softCriticalReasonDetected = v2ReasonCodes.some((code) => SOFT_CRITICAL_REASON_CODES.has(code));
  const softDecisionEligible = (
    SOFT_ENTRY_TYPES.has(entryType)
    && flags.enforce === true
    && (v2Decision === 'clarify' || v2Decision === 'refuse')
    && softCriticalReasonDetected
    && legacyDecision !== v2Decision
  );
  const hardDecisionEligible = (
    HARD_ENTRY_TYPES.has(entryType)
    && flags.enforceWebhook === true
    && legacyDecision !== v2Decision
  );

  let mode = flags.logOnly === true ? 'log_only_v2' : 'legacy_only';
  let enforceV2 = false;
  let enforcementReason = flags.logOnly === true ? 'log_only_default' : 'v2_disabled';
  if (softDecisionEligible) {
    mode = 'soft_enforced_v2';
    enforceV2 = true;
    enforcementReason = 'soft_critical_reason_match';
  } else if (hardDecisionEligible) {
    mode = 'hard_enforced_v2';
    enforceV2 = true;
    enforcementReason = 'hard_route_enforcement_enabled';
  } else if (flags.enforceWebhook === true && HARD_ENTRY_TYPES.has(entryType)) {
    mode = 'log_only_v2';
    enforcementReason = 'hard_route_no_delta';
  } else if (flags.enforce === true && SOFT_ENTRY_TYPES.has(entryType)) {
    mode = 'log_only_v2';
    enforcementReason = softCriticalReasonDetected ? 'soft_critical_reason_no_delta' : 'soft_reason_not_eligible';
  }

  return {
    entryType,
    stage,
    mode,
    logOnlyEnabled: flags.logOnly === true,
    enforceV2,
    answerReadinessLogOnlyV2: flags.logOnly === true && enforceV2 !== true,
    answerReadinessEnforcedV2: enforceV2 === true,
    enforcementReason,
    softCriticalReasonDetected
  };
}

module.exports = {
  resolveAnswerReadinessV2Mode
};
