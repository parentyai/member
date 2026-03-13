'use strict';

const crypto = require('crypto');

const faqArticlesRepo = require('../../repos/firestore/faqArticlesRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { FAQ_ANSWER_SCHEMA_ID } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { getDisclaimer } = require('../../llm/disclaimers');
const { toBlockedReasonCategory } = require('../../llm/blockedReasonCategory');
const { POLICY_SNAPSHOT_VERSION, buildRegulatoryProfile } = require('../../llm/regulatoryProfile');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildLlmInputView } = require('../llm/buildLlmInputView');
const { guardLlmOutput } = require('../llm/guardLlmOutput');
const { sanitizeRetrievalCandidates } = require('../assistant/retrieval/sanitizeRetrievalCandidates');
const { resolveLlmLegalPolicySnapshot } = require('../../domain/llm/policy/resolveLlmLegalPolicySnapshot');
const { resolveIntentRiskTier } = require('../../domain/llm/policy/resolveIntentRiskTier');
const { computeSourceReadiness } = require('../../domain/llm/knowledge/computeSourceReadiness');
const { runAnswerReadinessGateV2 } = require('../../domain/llm/quality/runAnswerReadinessGateV2');
const { resolveTelemetryCoverageSignals } = require('../../domain/llm/quality/resolveTelemetryCoverageSignals');
const { refineSavedFaqReuseSignals } = require('./refineSavedFaqReuseSignals');
const { buildKnowledgeReadinessCandidates } = require('./buildKnowledgeReadinessCandidates');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'faq_answer_v2_kb_only';
const MIN_SCORE = 1.2;
const TOP1_TOP2_RATIO = 1.2;
const GUIDE_ONLY_MODES = new Set([
  'faq_navigation',
  'question_refine',
  'checklist_guidance'
]);
const PERSONALIZATION_ALLOW_LIST = new Set(['locale', 'servicePhase']);
const SYSTEM_PROMPT = [
  'You are a FAQ assistant.',
  'Answer only from kbCandidates.',
  'If evidence is insufficient, do not answer.',
  'Use FAQAnswer.v1 schema.',
  'Do not include direct URLs. citations must use sourceType=link_registry and sourceId.',
  'Advisory only.'
].join('\n');

const FAQ_FIELD_CATEGORIES = Object.freeze({
  question: 'Internal',
  locale: 'Internal',
  intent: 'Internal',
  guideMode: 'Internal',
  personalization: 'Internal',
  'personalization.locale': 'Internal',
  'personalization.servicePhase': 'Internal',
  kbCandidates: 'Public',
  'kbCandidates.articleId': 'Public',
  'kbCandidates.title': 'Public',
  'kbCandidates.body': 'Public',
  'kbCandidates.tags': 'Public',
  'kbCandidates.riskLevel': 'Public',
  'kbCandidates.linkRegistryIds': 'Public',
  'kbCandidates.status': 'Public',
  'kbCandidates.validUntil': 'Public',
  'kbCandidates.allowedIntents': 'Public',
  'kbCandidates.disclaimerVersion': 'Public',
  'kbCandidates.version': 'Public',
  'kbCandidates.versionSemver': 'Public',
  'kbCandidates.searchScore': 'Public'
});

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function hashJson(value) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(value || {}), 'utf8').digest('hex');
  } catch (_err) {
    return null;
  }
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const asDate = value.toDate();
    if (asDate instanceof Date) return asDate.toISOString();
  }
  return new Date().toISOString();
}

function toIsoOrNull(value) {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

function normalizeLocale(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'ja';
  return value.trim();
}

function normalizeIntent(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value.trim();
}

function normalizeIntentToken(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return '';
  return value.trim().toLowerCase();
}

function normalizeQuestion(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeGuideMode(value) {
  if (value === null || value === undefined) return 'faq_navigation';
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (!GUIDE_ONLY_MODES.has(normalized)) return null;
  return normalized;
}

function normalizePersonalization(value) {
  if (value === null || value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value;
}

function detectPersonalizationViolations(personalization) {
  const payload = personalization || {};
  const keys = Object.keys(payload);
  const violations = [];
  for (const key of keys) {
    if (!PERSONALIZATION_ALLOW_LIST.has(key)) {
      violations.push({ key, reason: 'key_not_allowed' });
      continue;
    }
    const value = payload[key];
    if (value === null || value === undefined) continue;
    const isPrimitive = ['string', 'number', 'boolean'].includes(typeof value);
    if (!isPrimitive) {
      violations.push({ key, reason: 'value_type_not_allowed' });
    }
  }
  return {
    keys,
    violations,
    isAllowed: violations.length === 0
  };
}

function buildBlocked(params) {
  const payload = params || {};
  return {
    ok: false,
    blocked: true,
    httpStatus: 422,
    blockedReason: payload.blockedReason || 'blocked',
    traceId: payload.traceId || null,
    llmUsed: false,
    llmStatus: payload.llmStatus || 'blocked',
    blockedReasonCategory: payload.blockedReasonCategory || 'UNKNOWN',
    schemaErrors: payload.schemaErrors || null,
    fallbackActions: Array.isArray(payload.fallbackActions) ? payload.fallbackActions : [],
    suggestedFaqs: Array.isArray(payload.suggestedFaqs) ? payload.suggestedFaqs : [],
    kbMeta: payload.kbMeta || null,
    policySource: payload.policySource || 'system_flags',
    policyContext: payload.policyContext || 'default',
    legalDecision: payload.legalDecision || null,
    legalReasonCodes: Array.isArray(payload.legalReasonCodes) ? payload.legalReasonCodes : [],
    intentRiskTier: payload.intentRiskTier || null,
    riskReasonCodes: Array.isArray(payload.riskReasonCodes) ? payload.riskReasonCodes : [],
    sourceAuthorityScore: Number.isFinite(Number(payload.sourceAuthorityScore))
      ? Number(payload.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: Number.isFinite(Number(payload.sourceFreshnessScore))
      ? Number(payload.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: payload.sourceReadinessDecision || null,
    sourceReadinessReasons: Array.isArray(payload.sourceReadinessReasons) ? payload.sourceReadinessReasons : [],
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    readinessDecision: payload.readinessDecision || null,
    readinessReasonCodes: Array.isArray(payload.readinessReasonCodes) ? payload.readinessReasonCodes : [],
    readinessSafeResponseMode: payload.readinessSafeResponseMode || null,
    answerReadinessVersion: payload.answerReadinessVersion || null,
    answerReadinessLogOnlyV2: payload.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: payload.answerReadinessEnforcedV2 === true,
    answerReadinessV2Mode: payload.answerReadinessV2Mode || null,
    answerReadinessV2Stage: payload.answerReadinessV2Stage || null,
    answerReadinessV2EnforcementReason: payload.answerReadinessV2EnforcementReason || null,
    readinessDecisionV2: payload.readinessDecisionV2 || null,
    readinessReasonCodesV2: Array.isArray(payload.readinessReasonCodesV2) ? payload.readinessReasonCodesV2 : [],
    readinessSafeResponseModeV2: payload.readinessSafeResponseModeV2 || null,
    unsupportedClaimCount: Number.isFinite(Number(payload.unsupportedClaimCount))
      ? Number(payload.unsupportedClaimCount)
      : 0,
    contradictionDetected: payload.contradictionDetected === true,
    savedFaqReused: payload.savedFaqReused === true,
    savedFaqReusePass: payload.savedFaqReusePass === true,
    savedFaqReuseReasonCodes: Array.isArray(payload.savedFaqReuseReasonCodes) ? payload.savedFaqReuseReasonCodes : [],
    sourceSnapshotRefs: Array.isArray(payload.sourceSnapshotRefs) ? payload.sourceSnapshotRefs : [],
    sanitizeApplied: payload.sanitizeApplied === true,
    sanitizedCandidateCount: Number.isFinite(Number(payload.sanitizedCandidateCount))
      ? Number(payload.sanitizedCandidateCount)
      : 0,
    sanitizeBlockedReasons: Array.isArray(payload.sanitizeBlockedReasons) ? payload.sanitizeBlockedReasons : [],
    injectionFindings: payload.injectionFindings === true,
    policySnapshotVersion: payload.policySnapshotVersion || POLICY_SNAPSHOT_VERSION,
    faqAnswer: null,
    disclaimerVersion: payload.disclaimerVersion || null,
    disclaimer: payload.disclaimer || null,
    serverTime: payload.serverTime || new Date().toISOString(),
    deprecated: false
  };
}

function buildFaqTelemetryFields(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const sourceReadiness = payload.sourceReadiness && typeof payload.sourceReadiness === 'object'
    ? payload.sourceReadiness
    : {};
  const answerReadiness = payload.answerReadiness && typeof payload.answerReadiness === 'object'
    ? payload.answerReadiness
    : {};
  const qualitySnapshot = answerReadiness.qualitySnapshot && typeof answerReadiness.qualitySnapshot === 'object'
    ? answerReadiness.qualitySnapshot
    : {};
  const savedFaqSignals = payload.savedFaqSignals && typeof payload.savedFaqSignals === 'object'
    ? payload.savedFaqSignals
    : {};
  const answerReadinessGate = payload.answerReadinessGate && typeof payload.answerReadinessGate === 'object'
    ? payload.answerReadinessGate
    : {};
  const readinessV2 = answerReadinessGate.readinessV2 && typeof answerReadinessGate.readinessV2 === 'object'
    ? answerReadinessGate.readinessV2
    : {};
  const readinessV2Snapshot = readinessV2.qualitySnapshot && typeof readinessV2.qualitySnapshot === 'object'
    ? readinessV2.qualitySnapshot
    : {};
  const readinessV2Telemetry = answerReadinessGate.telemetry && typeof answerReadinessGate.telemetry === 'object'
    ? answerReadinessGate.telemetry
    : {};
  const telemetryCoverage = resolveTelemetryCoverageSignals({
    sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision,
    sourceReadinessReasons: sourceReadiness.reasonCodes,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    evidenceCoverage: qualitySnapshot.evidenceCoverage,
    assistantQuality: qualitySnapshot,
    emergencyContext: readinessV2Telemetry.emergencyContextActive === true,
    emergencySeverity: readinessV2Telemetry.emergencySeverity || null,
    emergencyEventId: readinessV2Telemetry.emergencyEventId || null,
    emergencyOfficialSourceSatisfied: readinessV2Telemetry.emergencyOfficialSourceSatisfied === true,
    journeyContext: readinessV2Telemetry.journeyContext === true,
    journeyPhase: readinessV2Telemetry.journeyPhase || null,
    taskBlockerDetected: readinessV2Telemetry.taskBlockerDetected === true,
    blockedTask: readinessV2Telemetry.blockedTask || null,
    nextActions: readinessV2Telemetry.nextActions,
    journeyAlignedAction: readinessV2Telemetry.journeyAlignedAction,
    cityPackContext: readinessV2Telemetry.cityPackContext === true,
    cityPackPackId: readinessV2Telemetry.cityPackPackId || null,
    cityPackGrounded: readinessV2Telemetry.cityPackGrounded === true,
    cityPackFreshnessScore: readinessV2Telemetry.cityPackFreshnessScore,
    cityPackAuthorityScore: readinessV2Telemetry.cityPackAuthorityScore,
    cityPackValidation: readinessV2Telemetry.cityPackValidation,
    savedFaqReused: savedFaqSignals.savedFaqReused === true,
    savedFaqReusePass: savedFaqSignals.savedFaqReusePass === true,
    savedFaqReuseReasonCodes: savedFaqSignals.savedFaqReuseReasonCodes,
    savedFaqValid: readinessV2Telemetry.savedFaqValid,
    savedFaqAllowedIntent: readinessV2Telemetry.savedFaqAllowedIntent,
    savedFaqAuthorityScore: readinessV2Telemetry.savedFaqAuthorityScore,
    sourceSnapshotRefs: savedFaqSignals.sourceSnapshotRefs
  });
  return {
    policySource: payload.legalSnapshot && payload.legalSnapshot.policySource ? payload.legalSnapshot.policySource : 'system_flags',
    policyContext: payload.legalSnapshot && payload.legalSnapshot.policyContext ? payload.legalSnapshot.policyContext : 'default',
    legalDecision: payload.legalSnapshot && payload.legalSnapshot.legalDecision ? payload.legalSnapshot.legalDecision : null,
    legalReasonCodes: payload.legalSnapshot && Array.isArray(payload.legalSnapshot.legalReasonCodes)
      ? payload.legalSnapshot.legalReasonCodes
      : [],
    intentRiskTier: payload.riskSnapshot && payload.riskSnapshot.intentRiskTier ? payload.riskSnapshot.intentRiskTier : null,
    riskReasonCodes: payload.riskSnapshot && Array.isArray(payload.riskSnapshot.riskReasonCodes)
      ? payload.riskSnapshot.riskReasonCodes
      : [],
    sourceAuthorityScore: Number.isFinite(Number(sourceReadiness.sourceAuthorityScore))
      ? Number(sourceReadiness.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: Number.isFinite(Number(sourceReadiness.sourceFreshnessScore))
      ? Number(sourceReadiness.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision || null,
    sourceReadinessReasons: Array.isArray(sourceReadiness.reasonCodes) ? sourceReadiness.reasonCodes : [],
    evidenceCoverage: telemetryCoverage.evidenceCoverage,
    evidenceCoverageObserved: telemetryCoverage.evidenceCoverageObserved === true,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    officialOnlySatisfiedObserved: telemetryCoverage.officialOnlySatisfiedObserved === true
      ? true
      : (telemetryCoverage.officialOnlySatisfiedObserved === false ? false : null),
    readinessDecision: answerReadiness.decision || null,
    readinessReasonCodes: Array.isArray(answerReadiness.reasonCodes) ? answerReadiness.reasonCodes : [],
    readinessSafeResponseMode: answerReadiness.safeResponseMode || null,
    unsupportedClaimCount: Number.isFinite(Number(qualitySnapshot.unsupportedClaimCount))
      ? Number(qualitySnapshot.unsupportedClaimCount)
      : 0,
    contradictionDetected: qualitySnapshot.contradictionDetected === true,
    savedFaqReused: savedFaqSignals.savedFaqReused === true,
    savedFaqReusePass: savedFaqSignals.savedFaqReusePass === true,
    savedFaqReuseReasonCodes: Array.isArray(savedFaqSignals.savedFaqReuseReasonCodes)
      ? savedFaqSignals.savedFaqReuseReasonCodes
      : [],
    sourceSnapshotRefs: Array.isArray(savedFaqSignals.sourceSnapshotRefs)
      ? savedFaqSignals.sourceSnapshotRefs
      : [],
    answerReadinessLogOnly: typeof payload.answerReadinessLogOnly === 'boolean'
      ? payload.answerReadinessLogOnly
      : false,
    answerReadinessLogOnlyV2: answerReadinessGate.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: answerReadinessGate.answerReadinessEnforcedV2 === true,
    answerReadinessVersion: answerReadinessGate.answerReadinessVersion || null,
    answerReadinessV2Mode: answerReadinessGate.mode ? answerReadinessGate.mode.mode : null,
    answerReadinessV2Stage: answerReadinessGate.mode ? answerReadinessGate.mode.stage : null,
    answerReadinessV2EnforcementReason: answerReadinessGate.mode ? answerReadinessGate.mode.enforcementReason : null,
    readinessDecisionSource: answerReadiness.decisionSource || null,
    readinessDecisionSourceV2: readinessV2.decisionSource || null,
    readinessHardeningVersion: readinessV2Telemetry.readinessHardeningVersion || null,
    readinessDecisionV2: readinessV2.decision || null,
    readinessReasonCodesV2: Array.isArray(readinessV2.reasonCodes) ? readinessV2.reasonCodes : [],
    readinessSafeResponseModeV2: readinessV2.safeResponseMode || null,
    emergencyContextActive: readinessV2Telemetry.emergencyContextActive === true,
    emergencyOfficialSourceSatisfied: readinessV2Telemetry.emergencyOfficialSourceSatisfied === true,
    emergencyOfficialSourceSatisfiedObserved: telemetryCoverage.emergencyOfficialSourceSatisfiedObserved === true
      ? true
      : (telemetryCoverage.emergencyOfficialSourceSatisfiedObserved === false ? false : null),
    journeyPhase: readinessV2Telemetry.journeyPhase || null,
    taskBlockerDetected: readinessV2Telemetry.taskBlockerDetected === true,
    journeyAlignedAction: typeof readinessV2Telemetry.journeyAlignedAction === 'boolean'
      ? readinessV2Telemetry.journeyAlignedAction
      : true,
    journeyAlignedActionObserved: telemetryCoverage.journeyAlignedActionObserved === true
      ? true
      : (telemetryCoverage.journeyAlignedActionObserved === false ? false : null),
    cityPackGrounded: readinessV2Telemetry.cityPackGrounded === true,
    cityPackGroundedObserved: telemetryCoverage.cityPackGroundedObserved === true
      ? true
      : (telemetryCoverage.cityPackGroundedObserved === false ? false : null),
    cityPackFreshnessScore: Number.isFinite(Number(readinessV2Telemetry.cityPackFreshnessScore))
      ? Number(readinessV2Telemetry.cityPackFreshnessScore)
      : null,
    cityPackAuthorityScore: Number.isFinite(Number(readinessV2Telemetry.cityPackAuthorityScore))
      ? Number(readinessV2Telemetry.cityPackAuthorityScore)
      : null,
    staleSourceBlocked: telemetryCoverage.staleSourceBlocked === true
      ? true
      : (telemetryCoverage.staleSourceBlocked === false ? false : null),
    staleSourceBlockedObserved: telemetryCoverage.staleSourceBlockedObserved === true
      ? true
      : (telemetryCoverage.staleSourceBlockedObserved === false ? false : null),
    savedFaqValid: typeof readinessV2Telemetry.savedFaqValid === 'boolean'
      ? readinessV2Telemetry.savedFaqValid
      : (readinessV2Snapshot.savedFaqValid === true),
    savedFaqAllowedIntent: typeof readinessV2Telemetry.savedFaqAllowedIntent === 'boolean'
      ? readinessV2Telemetry.savedFaqAllowedIntent
      : (readinessV2Snapshot.savedFaqAllowedIntent === true),
    savedFaqAuthorityScore: Number.isFinite(Number(readinessV2Telemetry.savedFaqAuthorityScore))
      ? Number(readinessV2Telemetry.savedFaqAuthorityScore)
      : null,
    savedFaqReusePassObserved: telemetryCoverage.savedFaqReusePassObserved === true
      ? true
      : (telemetryCoverage.savedFaqReusePassObserved === false ? false : null),
    crossSystemConflictDetected: readinessV2Telemetry.crossSystemConflictDetected === true
  };
}

function looksLikeDirectUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function buildFallbackActions(allowedSourceIds, requiredContactSourceIds) {
  const safeAllowed = Array.isArray(allowedSourceIds)
    ? allowedSourceIds.filter((id) => typeof id === 'string' && id.trim().length > 0 && !looksLikeDirectUrl(id))
    : [];
  const safeRequired = Array.isArray(requiredContactSourceIds)
    ? requiredContactSourceIds.filter((id) => typeof id === 'string' && id.trim().length > 0 && !looksLikeDirectUrl(id))
    : [];

  const officialFaqSourceId = safeAllowed[0] || null;
  const contactSourceId = safeRequired.find((id) => id !== officialFaqSourceId) || safeAllowed[1] || null;

  const actions = [];
  if (officialFaqSourceId) {
    actions.push({
      actionKey: 'open_official_faq',
      label: '公式FAQを見る',
      sourceId: officialFaqSourceId
    });
  }
  if (contactSourceId) {
    actions.push({
      actionKey: 'open_contact',
      label: '問い合わせる',
      sourceId: contactSourceId
    });
  }
  return actions;
}

function buildSuggestedFaqs(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .slice(0, 3)
    .map((item) => ({
      articleId: item && item.id ? String(item.id) : '',
      title: item && item.title ? String(item.title) : ''
    }))
    .filter((item) => item.articleId.length > 0);
}

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.answerFaq !== 'function') throw new Error('adapter_missing');
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const exec = adapter.answerFaq(payload);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm_timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

function normalizeAnswerCandidate(adapterResult) {
  if (adapterResult && typeof adapterResult === 'object' && adapterResult.answer && typeof adapterResult.answer === 'object') {
    return { answer: adapterResult.answer, model: adapterResult.model || null };
  }
  return { answer: adapterResult, model: adapterResult && adapterResult.model ? adapterResult.model : null };
}

function collectAllowedSourceIds(articles) {
  const out = new Set();
  for (const article of articles || []) {
    const ids = Array.isArray(article.linkRegistryIds) ? article.linkRegistryIds : [];
    for (const id of ids) {
      if (typeof id === 'string' && id.trim().length > 0) out.add(id.trim());
    }
  }
  return Array.from(out);
}

function collectKnowledgeSourceRefs(article) {
  const out = new Set();
  const rows = article ? [article] : [];
  for (const item of rows) {
    const snapshotRefs = Array.isArray(item && item.sourceSnapshotRefs) ? item.sourceSnapshotRefs : [];
    snapshotRefs.forEach((ref) => {
      if (typeof ref === 'string' && ref.trim().length > 0) out.add(ref.trim());
    });
    const ids = Array.isArray(item && item.linkRegistryIds) ? item.linkRegistryIds : [];
    ids.forEach((id) => {
      if (typeof id === 'string' && id.trim().length > 0) out.add(id.trim());
    });
  }
  return Array.from(out);
}

function matchesAllowedIntent(allowedIntents, intent) {
  const normalizedIntent = normalizeIntentToken(intent);
  const rows = Array.isArray(allowedIntents) ? allowedIntents : [];
  if (!rows.length) return true;
  const normalized = rows
    .map((item) => normalizeIntentToken(item))
    .filter(Boolean);
  if (!normalized.length) return true;
  if (!normalizedIntent) return normalized.includes('general');
  return normalized.includes(normalizedIntent) || normalized.includes('general');
}

function isValidUntilUsable(validUntil, nowMs) {
  if (!validUntil) return true;
  const parsed = Date.parse(validUntil);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= nowMs;
}

function buildSavedFaqReuseSignals(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const candidates = Array.isArray(payload.candidates) ? payload.candidates : [];
  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();
  const primary = candidates[0] && typeof candidates[0] === 'object' ? candidates[0] : null;
  const sourceSnapshotRefs = collectKnowledgeSourceRefs(primary).slice(0, 8);
  if (!primary) {
    return {
      savedFaqReused: false,
      savedFaqReusePass: false,
      savedFaqReuseReasonCodes: ['no_saved_faq_candidate'],
      sourceSnapshotRefs
    };
  }
  const reasonCodes = [];
  if (!matchesAllowedIntent(primary.allowedIntents, payload.intent)) {
    reasonCodes.push('saved_faq_intent_mismatch');
  }
  if (!isValidUntilUsable(primary.validUntil, nowMs)) {
    reasonCodes.push('saved_faq_stale');
  }
  if (payload.intentRiskTier === 'high' && sourceSnapshotRefs.length === 0) {
    reasonCodes.push('saved_faq_missing_official_source_refs');
  }
  return {
    savedFaqReused: true,
    savedFaqReusePass: reasonCodes.length === 0,
    savedFaqReuseReasonCodes: reasonCodes.length ? reasonCodes : ['saved_faq_reuse_ready'],
    sourceSnapshotRefs
  };
}

function collectRequiredContactSourceIds(articles) {
  const out = new Set();
  for (const article of articles || []) {
    if (!article || String(article.riskLevel || 'low').toLowerCase() !== 'high') continue;
    const ids = Array.isArray(article.linkRegistryIds) ? article.linkRegistryIds : [];
    for (const id of ids) {
      if (typeof id === 'string' && id.trim().length > 0) out.add(id.trim());
    }
  }
  return Array.from(out);
}

function extractCitationSourceIds(answer) {
  const citations = answer && Array.isArray(answer.citations) ? answer.citations : [];
  const out = new Set();
  for (const citation of citations) {
    if (!citation || citation.sourceType !== 'link_registry') continue;
    if (typeof citation.sourceId !== 'string') continue;
    const sourceId = citation.sourceId.trim();
    if (sourceId) out.add(sourceId);
  }
  return out;
}

function hasRequiredCitation(answer, requiredSourceIds) {
  if (!Array.isArray(requiredSourceIds) || requiredSourceIds.length === 0) return true;
  const cited = extractCitationSourceIds(answer);
  return requiredSourceIds.some((id) => cited.has(id));
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveLlmPolicySnapshot(policy) {
  return resolveLlmLegalPolicySnapshot({ policy }).policy;
}

function isConsentMissingByPolicy(policy) {
  const snapshot = resolveLlmLegalPolicySnapshot({ policy });
  return snapshot.legalDecision === 'blocked' && snapshot.legalReasonCodes.includes('consent_missing');
}

function buildAuditSummaryBase(params) {
  const payload = params || {};
  const sourceReadiness = payload.sourceReadiness && typeof payload.sourceReadiness === 'object'
    ? payload.sourceReadiness
    : {};
  const answerReadiness = payload.answerReadiness && typeof payload.answerReadiness === 'object'
    ? payload.answerReadiness
    : {};
  const answerReadinessGate = payload.answerReadinessGate && typeof payload.answerReadinessGate === 'object'
    ? payload.answerReadinessGate
    : {};
  const readinessV2 = answerReadinessGate.readinessV2 && typeof answerReadinessGate.readinessV2 === 'object'
    ? answerReadinessGate.readinessV2
    : {};
  const readinessV2Telemetry = answerReadinessGate.telemetry && typeof answerReadinessGate.telemetry === 'object'
    ? answerReadinessGate.telemetry
    : {};
  return {
    purpose: 'faq',
    llmEnabled: payload.llmEnabled,
    envLlmFeatureFlag: payload.envEnabled,
    dbLlmEnabled: payload.dbEnabled,
    policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
    policySource: payload.policySource || 'system_flags',
    policyContext: payload.policyContext || 'default',
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    disclaimerVersion: payload.disclaimerVersion,
    lawfulBasis: payload.llmPolicy.lawfulBasis,
    consentVerified: payload.llmPolicy.consentVerified,
    crossBorder: payload.llmPolicy.crossBorder,
    legalDecision: payload.legalDecision || null,
    legalReasonCodes: Array.isArray(payload.legalReasonCodes) ? payload.legalReasonCodes : [],
    kbMatchedIds: payload.matchedArticleIds,
    top1Score: payload.confidence.top1Score,
    top2Score: payload.confidence.top2Score,
    top1Top2Ratio: payload.confidence.top1Top2Ratio,
    guideMode: payload.guideMode,
    personalizationKeys: payload.personalizationKeys || [],
    sanitizeApplied: payload.sanitizeApplied === true,
    sanitizedCandidateCount: Number.isFinite(Number(payload.sanitizedCandidateCount))
      ? Number(payload.sanitizedCandidateCount)
      : 0,
    sanitizeBlockedReasons: Array.isArray(payload.sanitizeBlockedReasons) ? payload.sanitizeBlockedReasons : [],
    injectionFindings: payload.injectionFindings === true,
    intentRiskTier: payload.intentRiskTier || 'low',
    riskReasonCodes: Array.isArray(payload.riskReasonCodes) ? payload.riskReasonCodes : [],
    sourceAuthorityScore: Number.isFinite(Number(sourceReadiness.sourceAuthorityScore))
      ? Number(sourceReadiness.sourceAuthorityScore)
      : null,
    sourceFreshnessScore: Number.isFinite(Number(sourceReadiness.sourceFreshnessScore))
      ? Number(sourceReadiness.sourceFreshnessScore)
      : null,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision || null,
    sourceReadinessReasons: Array.isArray(sourceReadiness.reasonCodes) ? sourceReadiness.reasonCodes : [],
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    readinessDecision: answerReadiness.decision || null,
    readinessReasonCodes: Array.isArray(answerReadiness.reasonCodes) ? answerReadiness.reasonCodes : [],
    readinessSafeResponseMode: answerReadiness.safeResponseMode || null,
    unsupportedClaimCount: answerReadiness.qualitySnapshot && Number.isFinite(Number(answerReadiness.qualitySnapshot.unsupportedClaimCount))
      ? Number(answerReadiness.qualitySnapshot.unsupportedClaimCount)
      : 0,
    contradictionDetected: answerReadiness.qualitySnapshot
      ? answerReadiness.qualitySnapshot.contradictionDetected === true
      : false,
    savedFaqReused: payload.savedFaqSignals ? payload.savedFaqSignals.savedFaqReused === true : false,
    savedFaqReusePass: payload.savedFaqSignals ? payload.savedFaqSignals.savedFaqReusePass === true : false,
    savedFaqReuseReasonCodes: payload.savedFaqSignals && Array.isArray(payload.savedFaqSignals.savedFaqReuseReasonCodes)
      ? payload.savedFaqSignals.savedFaqReuseReasonCodes
      : [],
    sourceSnapshotRefs: payload.savedFaqSignals && Array.isArray(payload.savedFaqSignals.sourceSnapshotRefs)
      ? payload.savedFaqSignals.sourceSnapshotRefs
      : [],
    answerReadinessLogOnly: typeof payload.answerReadinessLogOnly === 'boolean'
      ? payload.answerReadinessLogOnly
      : false,
    answerReadinessLogOnlyV2: answerReadinessGate.answerReadinessLogOnlyV2 === true,
    answerReadinessEnforcedV2: answerReadinessGate.answerReadinessEnforcedV2 === true,
    answerReadinessVersion: answerReadinessGate.answerReadinessVersion || null,
    answerReadinessV2Mode: answerReadinessGate.mode ? answerReadinessGate.mode.mode : null,
    answerReadinessV2Stage: answerReadinessGate.mode ? answerReadinessGate.mode.stage : null,
    answerReadinessV2EnforcementReason: answerReadinessGate.mode ? answerReadinessGate.mode.enforcementReason : null,
    readinessDecisionSource: answerReadiness.decisionSource || null,
    readinessDecisionSourceV2: readinessV2.decisionSource || null,
    readinessHardeningVersion: readinessV2Telemetry.readinessHardeningVersion || null,
    readinessDecisionV2: readinessV2.decision || null,
    readinessReasonCodesV2: Array.isArray(readinessV2.reasonCodes) ? readinessV2.reasonCodes : [],
    readinessSafeResponseModeV2: readinessV2.safeResponseMode || null,
    emergencyContextActive: readinessV2Telemetry.emergencyContextActive === true,
    emergencyOfficialSourceSatisfied: readinessV2Telemetry.emergencyOfficialSourceSatisfied === true,
    journeyPhase: readinessV2Telemetry.journeyPhase || null,
    taskBlockerDetected: readinessV2Telemetry.taskBlockerDetected === true,
    journeyAlignedAction: typeof readinessV2Telemetry.journeyAlignedAction === 'boolean'
      ? readinessV2Telemetry.journeyAlignedAction
      : true,
    cityPackGrounded: readinessV2Telemetry.cityPackGrounded === true,
    cityPackFreshnessScore: Number.isFinite(Number(readinessV2Telemetry.cityPackFreshnessScore))
      ? Number(readinessV2Telemetry.cityPackFreshnessScore)
      : null,
    cityPackAuthorityScore: Number.isFinite(Number(readinessV2Telemetry.cityPackAuthorityScore))
      ? Number(readinessV2Telemetry.cityPackAuthorityScore)
      : null,
    savedFaqValid: typeof readinessV2Telemetry.savedFaqValid === 'boolean' ? readinessV2Telemetry.savedFaqValid : true,
    savedFaqAllowedIntent: typeof readinessV2Telemetry.savedFaqAllowedIntent === 'boolean'
      ? readinessV2Telemetry.savedFaqAllowedIntent
      : true,
    savedFaqAuthorityScore: Number.isFinite(Number(readinessV2Telemetry.savedFaqAuthorityScore))
      ? Number(readinessV2Telemetry.savedFaqAuthorityScore)
      : null,
    crossSystemConflictDetected: readinessV2Telemetry.crossSystemConflictDetected === true,
    inputFieldCategoriesUsed: payload.inputFieldCategoriesUsed,
    fieldCategoriesUsed: payload.inputFieldCategoriesUsed
  };
}

function evaluateConfidence(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      confident: false,
      blockedReason: 'kb_no_match',
      top1Score: null,
      top2Score: null,
      top1Top2Ratio: null
    };
  }
  const withScore = candidates
    .map((item) => toNumberOrNull(item && item.searchScore))
    .filter((value) => value !== null);
  if (!withScore.length) {
    return {
      confident: true,
      blockedReason: null,
      top1Score: null,
      top2Score: null,
      top1Top2Ratio: null
    };
  }
  const top1Score = withScore[0];
  const top2Score = withScore.length > 1 ? withScore[1] : null;
  const top1Top2Ratio = top2Score && top2Score > 0 ? top1Score / top2Score : null;
  if (top1Score < MIN_SCORE) {
    return {
      confident: false,
      blockedReason: 'low_confidence',
      top1Score,
      top2Score,
      top1Top2Ratio
    };
  }
  if (top2Score && top2Score > 0 && top1Top2Ratio !== null && top1Top2Ratio < TOP1_TOP2_RATIO) {
    return {
      confident: false,
      blockedReason: 'low_confidence',
      top1Score,
      top2Score,
      top1Top2Ratio
    };
  }
  return {
    confident: true,
    blockedReason: null,
    top1Score,
    top2Score,
    top1Top2Ratio
  };
}

function buildKbMeta(candidates, confidence) {
  const safe = confidence || {};
  return {
    matchedCount: Array.isArray(candidates) ? candidates.length : 0,
    top1Score: safe.top1Score === undefined ? null : safe.top1Score,
    top2Score: safe.top2Score === undefined ? null : safe.top2Score,
    top1Top2Ratio: safe.top1Top2Ratio === undefined ? null : safe.top1Top2Ratio
  };
}

async function appendAudit(data, deps) {
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  if (!auditFn) return null;
  const result = await auditFn(data);
  return result && result.id ? result.id : null;
}

async function appendFaqAnswerLog(data, deps) {
  const repo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  if (!repo || typeof repo.appendFaqAnswerLog !== 'function') return null;
  const result = await repo.appendFaqAnswerLog(data);
  return result && result.id ? result.id : null;
}

async function appendDisclaimerRenderedAudit(params, deps) {
  const payload = params || {};
  return appendAudit({
    actor: payload.actor || 'unknown',
    action: 'llm_disclaimer_rendered',
    eventType: 'LLM_DISCLAIMER_RENDERED',
    entityType: 'llm_disclaimer',
    entityId: payload.purpose || 'faq',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
      payloadSummary: {
        purpose: payload.purpose || 'faq',
        surface: payload.surface || 'api',
        disclaimerVersion: payload.disclaimerVersion || null,
        disclaimerShown: payload.disclaimerShown !== false,
        llmStatus: payload.llmStatus || null,
      inputFieldCategoriesUsed: []
    }
  }, deps);
}

async function answerFaqFromKb(params, deps) {
  const payload = params || {};
  const question = normalizeQuestion(payload.question);
  if (!question) throw new Error('question required');

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const serverTime = toIso(now);
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0 ? payload.actor.trim() : 'unknown';

  const locale = normalizeLocale(payload.locale);
  const intent = normalizeIntent(payload.intent);
  const guideMode = normalizeGuideMode(payload.guideMode);
  const personalization = normalizePersonalization(payload.personalization);
  const personalizationCheck = detectPersonalizationViolations(personalization || {});

  const env = deps && deps.env ? deps.env : process.env;
  const envEnabled = isLlmFeatureEnabled(env);
  const getLlmEnabled = deps && deps.getLlmEnabled ? deps.getLlmEnabled : systemFlagsRepo.getLlmEnabled;
  const getLlmPolicy = deps && Object.prototype.hasOwnProperty.call(deps, 'getLlmPolicy')
    ? deps.getLlmPolicy
    : (deps ? async () => Object.assign({}, systemFlagsRepo.DEFAULT_LLM_POLICY) : systemFlagsRepo.getLlmPolicy);
  const dbEnabled = await getLlmEnabled();
  const legalSnapshot = resolveLlmLegalPolicySnapshot({ policy: await getLlmPolicy() });
  const llmPolicy = legalSnapshot.policy;
  const disclaimer = getDisclaimer('faq', { policy: llmPolicy });
  const llmEnabled = Boolean(envEnabled && dbEnabled);

  const kbRepo = deps && deps.faqArticlesRepo ? deps.faqArticlesRepo : faqArticlesRepo;
  const rawCandidates = await kbRepo.searchActiveArticles({
    query: question,
    locale,
    intent,
    limit: 5
  });
  const sanitizeResult = sanitizeRetrievalCandidates([rawCandidates]);
  const candidates = Array.isArray(sanitizeResult.candidatesByGroup) && Array.isArray(sanitizeResult.candidatesByGroup[0])
    ? sanitizeResult.candidatesByGroup[0]
    : [];
  const sanitizeApplied = sanitizeResult.sanitizeApplied === true;
  const sanitizedCandidateCount = Number.isFinite(Number(sanitizeResult.sanitizedCandidateCount))
    ? Number(sanitizeResult.sanitizedCandidateCount)
    : candidates.length;
  const sanitizeBlockedReasons = Array.isArray(sanitizeResult.blockedReasons) ? sanitizeResult.blockedReasons : [];
  const injectionFindings = sanitizeResult.injectionFindings === true;

  const matchedArticleIds = candidates.map((item) => item.id);
  const allowedSourceIds = collectAllowedSourceIds(candidates);
  const requiredContactSourceIds = collectRequiredContactSourceIds(candidates);
  const fallbackActions = buildFallbackActions(allowedSourceIds, requiredContactSourceIds);
  const suggestedFaqs = buildSuggestedFaqs(candidates);
  const confidence = evaluateConfidence(candidates);
  const kbMeta = buildKbMeta(candidates, confidence);
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: intent || 'general',
    savedFaqContext: candidates.length > 0
  });
  const rawSavedFaqSignals = buildSavedFaqReuseSignals({
    candidates,
    intent,
    intentRiskTier: riskSnapshot.intentRiskTier,
    nowMs: now.getTime()
  });
  const sourceReadiness = computeSourceReadiness({
    intentRiskTier: riskSnapshot.intentRiskTier,
    candidates: buildKnowledgeReadinessCandidates(candidates),
    retrievalQuality: confidence.confident ? 'good' : 'bad',
    retrieveNeeded: true,
    evidenceCoverage: confidence.top1Score !== null && confidence.top1Score !== undefined
      ? Math.max(0, Math.min(1, Number(confidence.top1Score)))
      : 0
  });
  const savedFaqSignals = refineSavedFaqReuseSignals({
    savedFaqSignals: rawSavedFaqSignals,
    sourceReadiness,
    intentRiskTier: riskSnapshot.intentRiskTier
  });
  const answerReadinessGate = runAnswerReadinessGateV2({
    entryType: typeof payload.entryType === 'string' && payload.entryType.trim()
      ? payload.entryType.trim()
      : 'faq',
    lawfulBasis: legalSnapshot.lawfulBasis,
    consentVerified: legalSnapshot.consentVerified,
    crossBorder: legalSnapshot.crossBorder,
    legalDecision: legalSnapshot.legalDecision,
    intentRiskTier: riskSnapshot.intentRiskTier,
    sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    unsupportedClaimCount: 0,
    contradictionDetected: false,
    evidenceCoverage: confidence.top1Score !== null && confidence.top1Score !== undefined
      ? Math.max(0, Math.min(1, Number(confidence.top1Score)))
      : 0,
    fallbackType: null,
    savedFaqContext: savedFaqSignals.savedFaqReused === true,
    savedFaqReused: savedFaqSignals.savedFaqReused === true,
    savedFaqReusePass: savedFaqSignals.savedFaqReusePass === true,
    savedFaqReuseReasonCodes: savedFaqSignals.savedFaqReuseReasonCodes,
    savedFaqValid: !savedFaqSignals.savedFaqReuseReasonCodes.includes('saved_faq_stale'),
    savedFaqAllowedIntent: !savedFaqSignals.savedFaqReuseReasonCodes.includes('saved_faq_intent_mismatch'),
    savedFaqAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceSnapshotRefs: savedFaqSignals.sourceSnapshotRefs,
    crossSystemConflictDetected: false
  });
  const answerReadiness = answerReadinessGate.readiness;
  const normalizedPersonalization = personalizationCheck.isAllowed
    ? {
      locale: personalizationCheck.keys.includes('locale') && personalization ? personalization.locale : undefined,
      servicePhase: personalizationCheck.keys.includes('servicePhase') && personalization
        ? personalization.servicePhase
        : undefined
    }
    : {};

  const llmInput = {
    question,
    locale,
    intent,
    guideMode,
    personalization: normalizedPersonalization,
    kbCandidates: candidates.map((item) => ({
      articleId: item.id,
      title: item.title || '',
      body: item.body || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      riskLevel: item.riskLevel || 'low',
      linkRegistryIds: Array.isArray(item.linkRegistryIds) ? item.linkRegistryIds : [],
      status: item.status || null,
      validUntil: toIsoOrNull(item.validUntil),
      allowedIntents: Array.isArray(item.allowedIntents) ? item.allowedIntents : [],
      disclaimerVersion: item.disclaimerVersion || null,
      version: item.version || null,
      versionSemver: item.versionSemver || null,
      searchScore: toNumberOrNull(item.searchScore)
    }))
  };

  const view = buildLlmInputView({
    input: llmInput,
    allowList: [
      'question',
      'locale',
      'intent',
      'guideMode',
      'personalization',
      'personalization.locale',
      'personalization.servicePhase',
      'kbCandidates',
      'kbCandidates.articleId',
      'kbCandidates.title',
      'kbCandidates.body',
      'kbCandidates.tags',
      'kbCandidates.riskLevel',
      'kbCandidates.linkRegistryIds',
      'kbCandidates.status',
      'kbCandidates.validUntil',
      'kbCandidates.allowedIntents',
      'kbCandidates.disclaimerVersion',
      'kbCandidates.version',
      'kbCandidates.versionSemver',
      'kbCandidates.searchScore'
    ],
    fieldCategories: FAQ_FIELD_CATEGORIES,
    allowRestricted: false
  });

  let blocked = null;
  if (!view.ok) {
    blocked = buildBlocked({
      blockedReason: view.blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(view.blockedReason),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: view.blockedReason,
      serverTime
    });
  } else if (guideMode === null) {
    blocked = buildBlocked({
      blockedReason: 'guide_only_mode_blocked',
      blockedReasonCategory: toBlockedReasonCategory('guide_only_mode_blocked'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: 'guide_only_mode_blocked',
      serverTime
    });
  } else if (personalization === null || !personalizationCheck.isAllowed) {
    blocked = buildBlocked({
      blockedReason: 'personalization_not_allowed',
      blockedReasonCategory: toBlockedReasonCategory('personalization_not_allowed'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: 'personalization_not_allowed',
      serverTime
    });
  } else if (!llmEnabled) {
    blocked = buildBlocked({
      blockedReason: 'llm_disabled',
      blockedReasonCategory: toBlockedReasonCategory('llm_disabled'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: 'llm_disabled',
      serverTime
    });
  } else if (isConsentMissingByPolicy(llmPolicy)) {
    blocked = buildBlocked({
      blockedReason: 'consent_missing',
      blockedReasonCategory: toBlockedReasonCategory('consent_missing'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: 'consent_missing',
      serverTime
    });
  } else if (!confidence.confident) {
    blocked = buildBlocked({
      blockedReason: confidence.blockedReason || 'low_confidence',
      blockedReasonCategory: toBlockedReasonCategory(confidence.blockedReason || 'low_confidence'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: confidence.blockedReason || 'low_confidence',
      serverTime
    });
  } else if (sourceReadiness.sourceReadinessDecision === 'refuse' || sourceReadiness.sourceReadinessDecision === 'clarify') {
    const blockedReason = sourceReadiness.sourceReadinessDecision === 'refuse'
      ? 'source_readiness_refuse'
      : 'source_readiness_clarify';
    blocked = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: blockedReason,
      serverTime
    });
  } else if (answerReadiness.decision === 'refuse' || answerReadiness.decision === 'clarify') {
    const blockedReason = answerReadiness.decision === 'refuse'
      ? 'answer_readiness_refuse'
      : 'answer_readiness_clarify';
    blocked = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: blockedReason,
      serverTime
    });
  } else if (candidates.some((item) => String(item.riskLevel || '').toLowerCase() === 'high') && requiredContactSourceIds.length === 0) {
    blocked = buildBlocked({
      blockedReason: 'contact_source_required',
      blockedReasonCategory: toBlockedReasonCategory('contact_source_required'),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: 'contact_source_required',
      serverTime
    });
  }

  if (blocked) {
    blocked.sanitizeApplied = sanitizeApplied;
    blocked.sanitizedCandidateCount = sanitizedCandidateCount;
    blocked.sanitizeBlockedReasons = sanitizeBlockedReasons.slice(0, 8);
    blocked.injectionFindings = injectionFindings;
  }

  if (blocked) {
    blocked.disclaimerVersion = disclaimer.version;
    blocked.disclaimer = disclaimer.text;
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          policySource: legalSnapshot.policySource,
          policyContext: legalSnapshot.policyContext,
          legalDecision: legalSnapshot.legalDecision,
          legalReasonCodes: legalSnapshot.legalReasonCodes,
          intentRiskTier: riskSnapshot.intentRiskTier,
          riskReasonCodes: riskSnapshot.riskReasonCodes,
          sourceReadiness,
          answerReadiness,
          answerReadinessGate,
          savedFaqSignals,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          guideMode,
          personalizationKeys: personalizationCheck.keys,
          sanitizeApplied,
          sanitizedCandidateCount,
          sanitizeBlockedReasons,
          injectionFindings,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blocked.blockedReason),
          blockedReason: blocked.blockedReason,
          inputHash: hashJson(view.data || llmInput),
          kbMeta,
          regulatoryProfile: buildRegulatoryProfile({
            policy: llmPolicy,
            fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
            blockedReasonCategory: toBlockedReasonCategory(blocked.blockedReason)
          })
        }
      )
    }, deps).catch(() => null);

    await appendFaqAnswerLog(Object.assign({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason: blocked.blockedReason
    }, buildFaqTelemetryFields({
      legalSnapshot,
      riskSnapshot,
      sourceReadiness,
      answerReadiness,
      answerReadinessGate,
      savedFaqSignals
    })), deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        surface: 'api',
        disclaimerVersion: disclaimer.version,
        llmStatus: blocked.llmStatus,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);

    return Object.assign(
      blocked,
      buildFaqTelemetryFields({
        legalSnapshot,
        riskSnapshot,
        sourceReadiness,
        answerReadiness,
        answerReadinessGate,
        savedFaqSignals
      }),
      { auditId }
    );
  }

  let answer;
  let llmModel = null;
  let llmStatus = 'ok';
  let guardResult = null;
  try {
    const adapterResult = await callAdapter(
      deps && deps.llmAdapter,
      {
        schemaId: FAQ_ANSWER_SCHEMA_ID,
        promptVersion: PROMPT_VERSION,
        system: SYSTEM_PROMPT,
        input: view.data
      },
      deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
    );
    const normalized = normalizeAnswerCandidate(adapterResult);
    answer = normalized.answer;
    llmModel = normalized.model;
  } catch (err) {
    llmStatus = err && err.message ? String(err.message) : 'llm_error';
  }

  if (answer) {
    guardResult = await guardLlmOutput({
      purpose: 'faq',
      schemaId: FAQ_ANSWER_SCHEMA_ID,
      output: answer,
      requireCitations: true,
      allowedSourceIds,
      checkWarnLinks: true
    }, deps);
    if (!guardResult.ok) {
      llmStatus = guardResult.blockedReason || 'blocked';
    }
  }

  if (!answer || !guardResult || !guardResult.ok) {
    const blockedReason = llmStatus || 'blocked';
    const blockedResult = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: blockedReason,
      schemaErrors: guardResult && guardResult.schemaErrors ? guardResult.schemaErrors : null,
      serverTime,
      disclaimerVersion: disclaimer.version,
      disclaimer: disclaimer.text
    });
    blockedResult.sanitizeApplied = sanitizeApplied;
    blockedResult.sanitizedCandidateCount = sanitizedCandidateCount;
    blockedResult.sanitizeBlockedReasons = sanitizeBlockedReasons.slice(0, 8);
    blockedResult.injectionFindings = injectionFindings;
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          policySource: legalSnapshot.policySource,
          policyContext: legalSnapshot.policyContext,
          legalDecision: legalSnapshot.legalDecision,
          legalReasonCodes: legalSnapshot.legalReasonCodes,
          intentRiskTier: riskSnapshot.intentRiskTier,
          riskReasonCodes: riskSnapshot.riskReasonCodes,
          sourceReadiness,
          answerReadiness,
          answerReadinessGate,
          savedFaqSignals,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          guideMode,
          personalizationKeys: personalizationCheck.keys,
          sanitizeApplied,
          sanitizedCandidateCount,
          sanitizeBlockedReasons,
          injectionFindings,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blockedReason),
          blockedReason,
          inputHash: hashJson(view.data),
          outputHash: answer ? hashJson(answer) : null,
          kbMeta,
          regulatoryProfile: buildRegulatoryProfile({
            policy: llmPolicy,
            fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
            blockedReasonCategory: toBlockedReasonCategory(blockedReason)
          })
        }
      )
    }, deps).catch(() => null);

    await appendFaqAnswerLog(Object.assign({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason
    }, buildFaqTelemetryFields({
      legalSnapshot,
      riskSnapshot,
      sourceReadiness,
      answerReadiness,
      answerReadinessGate,
      savedFaqSignals
    })), deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        surface: 'api',
        disclaimerVersion: disclaimer.version,
        llmStatus: blockedReason,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);

    return Object.assign(
      blockedResult,
      buildFaqTelemetryFields({
        legalSnapshot,
        riskSnapshot,
        sourceReadiness,
        answerReadiness,
        answerReadinessGate,
        savedFaqSignals
      }),
      { auditId }
    );
  }

  if (!hasRequiredCitation(answer, requiredContactSourceIds)) {
    const blockedReason = 'contact_source_required';
    const blockedResult = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      kbMeta,
      policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
      traceId,
      llmStatus: blockedReason,
      schemaErrors: null,
      serverTime,
      disclaimerVersion: disclaimer.version,
      disclaimer: disclaimer.text
    });
    blockedResult.sanitizeApplied = sanitizeApplied;
    blockedResult.sanitizedCandidateCount = sanitizedCandidateCount;
    blockedResult.sanitizeBlockedReasons = sanitizeBlockedReasons.slice(0, 8);
    blockedResult.injectionFindings = injectionFindings;
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          policySource: legalSnapshot.policySource,
          policyContext: legalSnapshot.policyContext,
          legalDecision: legalSnapshot.legalDecision,
          legalReasonCodes: legalSnapshot.legalReasonCodes,
          intentRiskTier: riskSnapshot.intentRiskTier,
          riskReasonCodes: riskSnapshot.riskReasonCodes,
          sourceReadiness,
          answerReadiness,
          answerReadinessGate,
          savedFaqSignals,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          guideMode,
          personalizationKeys: personalizationCheck.keys,
          sanitizeApplied,
          sanitizedCandidateCount,
          sanitizeBlockedReasons,
          injectionFindings,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blockedReason),
          blockedReason,
          inputHash: hashJson(view.data),
          outputHash: hashJson(answer),
          kbMeta,
          regulatoryProfile: buildRegulatoryProfile({
            policy: llmPolicy,
            fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
            blockedReasonCategory: toBlockedReasonCategory(blockedReason)
          })
        }
      )
    }, deps).catch(() => null);
    await appendFaqAnswerLog(Object.assign({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason
    }, buildFaqTelemetryFields({
      legalSnapshot,
      riskSnapshot,
      sourceReadiness,
      answerReadiness,
      answerReadinessGate,
      savedFaqSignals
    })), deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        surface: 'api',
        disclaimerVersion: disclaimer.version,
        llmStatus: blockedReason,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);
    return Object.assign(
      blockedResult,
      buildFaqTelemetryFields({
        legalSnapshot,
        riskSnapshot,
        sourceReadiness,
        answerReadiness,
        answerReadinessGate,
        savedFaqSignals
      }),
      { auditId }
    );
  }

  const auditId = await appendAudit({
    actor,
    action: 'llm_faq_answer_generated',
    eventType: 'LLM_FAQ_ANSWER_GENERATED',
    entityType: 'llm_faq',
    entityId: 'faq',
    traceId,
    requestId,
    payloadSummary: Object.assign(
      buildAuditSummaryBase({
        llmEnabled,
        envEnabled,
        dbEnabled,
        llmPolicy,
        policySource: legalSnapshot.policySource,
        policyContext: legalSnapshot.policyContext,
        legalDecision: legalSnapshot.legalDecision,
        legalReasonCodes: legalSnapshot.legalReasonCodes,
        intentRiskTier: riskSnapshot.intentRiskTier,
        riskReasonCodes: riskSnapshot.riskReasonCodes,
        sourceReadiness,
        answerReadiness,
        answerReadinessGate,
        savedFaqSignals,
        disclaimerVersion: disclaimer.version,
        matchedArticleIds,
        confidence,
        guideMode,
        personalizationKeys: personalizationCheck.keys,
        sanitizeApplied,
        sanitizedCandidateCount,
        sanitizeBlockedReasons,
        injectionFindings,
        inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
      }),
        {
          blockedReasonCategory: null,
          blockedReason: null,
          inputHash: hashJson(view.data),
          outputHash: hashJson(answer),
          kbMeta,
          regulatoryProfile: buildRegulatoryProfile({
            policy: llmPolicy,
            fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
            blockedReasonCategory: null
          })
        }
      )
  }, deps).catch(() => null);

  await appendFaqAnswerLog(Object.assign({
    traceId,
    questionHash: hashText(question),
    locale,
    matchedArticleIds,
    blockedReason: null
  }, buildFaqTelemetryFields({
    legalSnapshot,
    riskSnapshot,
    sourceReadiness,
    answerReadiness,
    answerReadinessGate,
    savedFaqSignals
  })), deps).catch(() => null);
  await appendDisclaimerRenderedAudit(
    {
      actor,
      traceId,
      requestId,
      purpose: 'faq',
      surface: 'api',
      disclaimerVersion: disclaimer.version,
      llmStatus: 'ok',
      disclaimerShown: true
    },
    deps
  ).catch(() => null);

  return Object.assign({
    ok: true,
    blocked: false,
    httpStatus: 200,
    traceId,
    question,
    serverTime,
    faqAnswer: answer,
    llmUsed: true,
    llmStatus: 'ok',
    llmModel,
    schemaErrors: null,
    blockedReason: null,
    blockedReasonCategory: null,
    fallbackActions: [],
    suggestedFaqs,
    kbMeta,
    sanitizeApplied,
    sanitizedCandidateCount,
    sanitizeBlockedReasons: sanitizeBlockedReasons.slice(0, 8),
    injectionFindings,
    policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
    disclaimerVersion: disclaimer.version,
    disclaimer: disclaimer.text,
    inputFieldCategoriesUsed: view.inputFieldCategoriesUsed,
    auditId
  }, buildFaqTelemetryFields({
    legalSnapshot,
    riskSnapshot,
    sourceReadiness,
    answerReadiness,
    answerReadinessGate,
    savedFaqSignals
  }));
}

module.exports = {
  answerFaqFromKb
};
