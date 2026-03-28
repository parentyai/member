'use strict';

const { buildAnswerReadinessContext } = require('./buildAnswerReadinessContext');
const { runAnswerReadinessGateV2 } = require('./runAnswerReadinessGateV2');
const { applyAnswerReadinessDecision } = require('./applyAnswerReadinessDecision');

const RESPONSE_QUALITY_CONTEXT_VERSION = 'response_quality_context_v1';
const RESPONSE_QUALITY_VERDICT_VERSION = 'response_quality_verdict_v1';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized || out.includes(normalized)) return;
    out.push(normalized);
  });
  return out.slice(0, 16);
}

function normalizeDecision(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'allow' || normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return fallback;
}

function normalizeSafeResponseMode(value, fallback) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'answer' || normalized === 'answer_with_hedge' || normalized === 'clarify' || normalized === 'refuse') {
    return normalized;
  }
  return fallback;
}

function hasMetric(value) {
  return value !== null && value !== undefined && Number.isFinite(Number(value));
}

function createResponseQualityContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  return {
    contractVersion: RESPONSE_QUALITY_CONTEXT_VERSION,
    entryType: normalizeText(payload.entryType) || 'unknown',
    requestShape: normalizeText(payload.requestShape).toLowerCase() || '',
    outputForm: normalizeText(payload.outputForm).toLowerCase() || '',
    transformSource: normalizeText(payload.transformSource).toLowerCase() || '',
    knowledgeScope: normalizeText(payload.knowledgeScope).toLowerCase() || '',
    suppressHedgeSuffix: payload.suppressHedgeSuffix === true,
    answerReadinessContext: payload.answerReadinessContext && typeof payload.answerReadinessContext === 'object'
      ? payload.answerReadinessContext
      : buildAnswerReadinessContext(payload)
  };
}

function resolveEffectiveReadiness(baseReadiness, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const fallback = baseReadiness && typeof baseReadiness === 'object'
    ? baseReadiness
    : {
      decision: 'allow',
      reasonCodes: [],
      safeResponseMode: 'answer',
      qualitySnapshot: {}
    };
  const override = payload.readinessOverride && typeof payload.readinessOverride === 'object'
    ? payload.readinessOverride
    : null;
  if (override) {
    return {
      decision: normalizeDecision(override.decision, fallback.decision),
      reasonCodes: normalizeReasonCodes(
        Array.isArray(override.reasonCodes) && override.reasonCodes.length
          ? override.reasonCodes
          : fallback.reasonCodes
      ),
      safeResponseMode: normalizeSafeResponseMode(override.safeResponseMode, fallback.safeResponseMode),
      qualitySnapshot: override.qualitySnapshot && typeof override.qualitySnapshot === 'object'
        ? override.qualitySnapshot
        : fallback.qualitySnapshot
    };
  }

  const explicitDecision = normalizeDecision(payload.readinessDecision, null);
  if (!explicitDecision) return fallback;

  return Object.assign({}, fallback, {
    decision: explicitDecision,
    reasonCodes: normalizeReasonCodes(
      Array.isArray(payload.readinessReasonCodes) && payload.readinessReasonCodes.length
        ? payload.readinessReasonCodes
        : fallback.reasonCodes
    ),
    safeResponseMode: normalizeSafeResponseMode(payload.readinessSafeResponseMode, fallback.safeResponseMode)
  });
}

function maybeAllowMissingSignals(readiness, params) {
  const payload = params && typeof params === 'object' ? params : {};
  const base = readiness && typeof readiness === 'object'
    ? readiness
    : {
      decision: 'allow',
      reasonCodes: [],
      safeResponseMode: 'answer',
      qualitySnapshot: {}
    };
  if (payload.allowWhenSignalsMissing !== true) return base;

  const contradictionFlags = Array.isArray(payload.contradictionFlags) ? payload.contradictionFlags : [];
  const contradictionDetected = payload.contradictionDetected === true || contradictionFlags.length > 0;
  const unsupportedClaimCount = Number.isFinite(Number(payload.unsupportedClaimCount))
    ? Math.max(0, Math.floor(Number(payload.unsupportedClaimCount)))
    : contradictionFlags.filter((item) => typeof item === 'string' && item.toLowerCase().includes('unsupported')).length;
  const legalBlocked = payload.legalSnapshot && payload.legalSnapshot.legalDecision === 'blocked';
  const sourceSignalPresent = hasMetric(payload.sourceAuthorityScore)
    || hasMetric(payload.sourceFreshnessScore)
    || normalizeText(payload.sourceReadinessDecision).length > 0;
  const riskTier = payload.riskSnapshot && typeof payload.riskSnapshot.intentRiskTier === 'string'
    ? payload.riskSnapshot.intentRiskTier.toLowerCase()
    : 'low';
  if (legalBlocked || sourceSignalPresent || contradictionDetected || unsupportedClaimCount > 0 || riskTier === 'high') {
    return base;
  }
  return Object.assign({}, base, {
    decision: 'allow',
    safeResponseMode: 'answer',
    reasonCodes: ['readiness_signal_missing_allow']
  });
}

function createResponseQualityVerdict(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const responseQualityContext = payload.responseQualityContext && typeof payload.responseQualityContext === 'object'
    ? payload.responseQualityContext
    : createResponseQualityContext(payload);
  const readinessGate = payload.readinessGate && typeof payload.readinessGate === 'object'
    ? payload.readinessGate
    : runAnswerReadinessGateV2({
      entryType: responseQualityContext.entryType,
      responseQualityContext,
      env: payload.env
    });
  const effectiveReadiness = maybeAllowMissingSignals(
    resolveEffectiveReadiness(readinessGate.readiness, payload),
    payload
  );
  const applied = applyAnswerReadinessDecision({
    decision: effectiveReadiness.decision,
    replyText: payload.replyText,
    clarifyText: payload.clarifyText,
    refuseText: payload.refuseText,
    hedgeSuffix: payload.hedgeSuffix,
    requestShape: responseQualityContext.requestShape,
    outputForm: responseQualityContext.outputForm,
    transformSource: responseQualityContext.transformSource,
    knowledgeScope: responseQualityContext.knowledgeScope,
    suppressHedgeSuffix: payload.suppressHedgeSuffix === true || responseQualityContext.suppressHedgeSuffix === true
  });

  return {
    contractVersion: RESPONSE_QUALITY_VERDICT_VERSION,
    responseQualityContext,
    readiness: effectiveReadiness,
    readinessV2: readinessGate.readinessV2,
    replyText: applied.replyText,
    enforced: applied.enforced === true,
    answerReadinessVersion: readinessGate.answerReadinessVersion,
    answerReadinessLogOnlyV2: readinessGate.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: readinessGate.answerReadinessEnforcedV2 === true,
    answerReadinessV2Mode: readinessGate.mode ? readinessGate.mode.mode : null,
    answerReadinessV2Stage: readinessGate.mode ? readinessGate.mode.stage : null,
    answerReadinessV2EnforcementReason: readinessGate.mode ? readinessGate.mode.enforcementReason : null,
    telemetry: Object.assign(
      {
        responseQualityContextVersion: responseQualityContext.contractVersion,
        responseQualityVerdictVersion: RESPONSE_QUALITY_VERDICT_VERSION
      },
      readinessGate.telemetry || {},
      payload.telemetryAdditions && typeof payload.telemetryAdditions === 'object'
        ? payload.telemetryAdditions
        : {}
    )
  };
}

module.exports = {
  RESPONSE_QUALITY_CONTEXT_VERSION,
  RESPONSE_QUALITY_VERDICT_VERSION,
  normalizeResponseQualityReasonCodes: normalizeReasonCodes,
  createResponseQualityContext,
  createResponseQualityVerdict
};
